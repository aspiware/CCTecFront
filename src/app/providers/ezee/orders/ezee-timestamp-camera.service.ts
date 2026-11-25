import { Injectable } from '@angular/core';
import * as camera from '@nativescript/camera';
import * as geolocation from '@nativescript/geolocation';
import {
  ApplicationSettings,
  CoreTypes,
  ImageSource,
  isAndroid,
  isIOS,
  knownFolders,
  path,
  Utils,
} from '@nativescript/core';
import { EzeeOrderListItem } from './ezee-order.model';

@Injectable({ providedIn: 'root' })
export class EzeeTimestampCameraService {
  private iosCameraDelegate?: UIImagePickerControllerDelegate & UINavigationControllerDelegate;

  public async capture(order: EzeeOrderListItem): Promise<string> {
    console.log('[EzeeTimestampCamera] Capture started');
    if (!camera.isAvailable()) {
      throw new Error('Camera is not available on this device.');
    }

    const permission = await camera.requestCameraPermissions();
    if (!permission?.Success) {
      throw new Error('Camera permission is required to capture an order photo.');
    }

    console.log('[EzeeTimestampCamera] Camera permission granted');
    await this.requestLocationPermission();
    const locationPromise = this.getLocation();
    const source = isIOS
      ? await this.takeIosPicture(order, locationPromise)
      : await ImageSource.fromAsset(await camera.takePicture({
          width: 2048,
          height: 2048,
          keepAspectRatio: true,
          saveToGallery: false,
          cameraFacing: 'rear',
        }));
    console.log('[EzeeTimestampCamera] Photo captured');
    const location = await locationPromise;
    const capturedAt = new Date();
    const lines = this.buildStampLines(order, capturedAt, location);
    const stamped = isIOS
      ? this.stampIos(source, order, capturedAt, location)
      : isAndroid
        ? this.stampAndroid(source, lines)
        : source;

    const folder = knownFolders.documents().getFolder('ezee-timestamp-photos');
    const fileName = `ezee-${this.safeFilePart(order.number)}-${this.fileTimestamp(capturedAt)}.jpg`;
    const filePath = path.join(folder.path, fileName);
    if (!stamped.saveToFile(filePath, 'jpg', 92)) {
      throw new Error('Unable to save the timestamped photo.');
    }
    return filePath;
  }

  private takeIosPicture(
    order: EzeeOrderListItem,
    locationPromise: Promise<geolocation.Location | null>
  ): Promise<ImageSource> {
    return new Promise((resolve, reject) => {
      try {
        const visibleViewController = this.getVisibleIosViewController();
        if (!visibleViewController) {
          reject(new Error('Unable to present the camera from the current screen.'));
          return;
        }

        const picker = UIImagePickerController.new();
        picker.sourceType = UIImagePickerControllerSourceType.Camera;
        picker.cameraDevice = UIImagePickerControllerCameraDevice.Rear;
        picker.mediaTypes = NSArray.arrayWithObject('public.image');
        picker.allowsEditing = false;
        const coordinateLabel = this.createIosCameraOverlay(picker, order);
        void locationPromise.then((location) => {
          Utils.executeOnMainThread(() => {
            coordinateLabel.text = this.coordinateText(location);
          });
        });

        const owner = new WeakRef(this);
        const DelegateClass = (NSObject as any).extend(
          {
            imagePickerControllerDidCancel(controller: UIImagePickerController) {
              controller.dismissViewControllerAnimatedCompletion(true, () => {
                const service = owner.deref();
                if (service) {
                  service.iosCameraDelegate = undefined;
                }
                reject(new Error('cancelled'));
              });
            },
            imagePickerControllerDidFinishPickingMediaWithInfo(
              controller: UIImagePickerController,
              info: NSDictionary<any, any>
            ) {
              const image =
                info?.objectForKey(UIImagePickerControllerOriginalImage) ||
                info?.objectForKey(UIImagePickerControllerEditedImage);
              if (!image) {
                controller.dismissViewControllerAnimatedCompletion(true, () => {
                  const service = owner.deref();
                  if (service) {
                    service.iosCameraDelegate = undefined;
                  }
                  reject(new Error('The camera did not return a photo.'));
                });
                return;
              }
              const source = new ImageSource(image);
              controller.dismissViewControllerAnimatedCompletion(true, () => {
                const service = owner.deref();
                if (service) {
                  service.iosCameraDelegate = undefined;
                }
                console.log('[EzeeTimestampCamera] Native iOS photo accepted');
                resolve(source);
              });
            },
          },
          {
            protocols: [UIImagePickerControllerDelegate, UINavigationControllerDelegate],
            name: `EzeeTimestampCameraDelegate${Date.now()}`,
          }
        );

        this.iosCameraDelegate = DelegateClass.new();
        picker.delegate = this.iosCameraDelegate;
        console.log('[EzeeTimestampCamera] Presenting native iOS camera');
        visibleViewController.presentViewControllerAnimatedCompletion(picker, true, null);
      } catch (error) {
        console.log(
          '[EzeeTimestampCamera] Failed to present iOS camera',
          error,
          error instanceof Error ? error.stack : ''
        );
        this.iosCameraDelegate = undefined;
        reject(error);
      }
    });
  }

  private createIosCameraOverlay(
    picker: UIImagePickerController,
    order: EzeeOrderListItem
  ): UILabel {
    const bounds = picker.view.bounds;
    const overlay = UIView.alloc().initWithFrame(bounds);
    overlay.backgroundColor = UIColor.clearColor;
    overlay.userInteractionEnabled = false;
    overlay.autoresizingMask = UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;

    const left = 18;
    const bottom = 126;
    const contentWidth = bounds.size.width - (left * 2);
    const startY = bounds.size.height - bottom - 310;
    const logo = UIView.alloc().initWithFrame(CGRectMake(left, startY, 142, 62));
    logo.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0.92);
    logo.layer.cornerRadius = 9;
    logo.layer.masksToBounds = true;
    const ezeeLogo = UIImageView.alloc().initWithFrame(CGRectMake(8, 7, 126, 48));
    ezeeLogo.image = this.iosEzeeLogo();
    ezeeLogo.contentMode = UIViewContentMode.ScaleAspectFit;
    logo.addSubview(ezeeLogo);
    overlay.addSubview(logo);

    const now = new Date();
    const timeParts = this.timeParts(now);
    const time = this.makeOverlayLabel(CGRectMake(left, startY + 72, 145, 66), timeParts.time, 58);
    time.font = UIFont.systemFontOfSizeWeight(58, UIFontWeightLight);
    overlay.addSubview(time);
    const meridiem = this.makeOverlayLabel(CGRectMake(left + 145, startY + 74, 36, 25), timeParts.meridiem, 17);
    overlay.addSubview(meridiem);

    const divider = UIView.alloc().initWithFrame(CGRectMake(left + 183, startY + 76, 3, 61));
    divider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(1, 0.71, 0.05, 1);
    overlay.addSubview(divider);
    const date = this.makeOverlayLabel(
      CGRectMake(left + 198, startY + 76, contentWidth - 198, 31),
      this.dateText(now),
      21
    );
    overlay.addSubview(date);
    const weekday = this.makeOverlayLabel(
      CGRectMake(left + 198, startY + 108, contentWidth - 198, 29),
      this.weekdayText(now),
      20
    );
    overlay.addSubview(weekday);

    const address = this.makeOverlayLabel(
      CGRectMake(left, startY + 145, contentWidth, 40),
      this.formatAddress(order?.address),
      15
    );
    address.numberOfLines = 2;
    overlay.addSubview(address);
    const coordinates = this.makeOverlayLabel(
      CGRectMake(left, startY + 188, contentWidth, 28),
      'Coordinate: locating…',
      15
    );
    overlay.addSubview(coordinates);
    const orderLabel = this.makeOverlayLabel(
      CGRectMake(left, startY + 221, contentWidth, 26),
      `Order #: ${String(order?.number || 'n/a')}`,
      15
    );
    overlay.addSubview(orderLabel);
    const technician = this.makeOverlayLabel(
      CGRectMake(left, startY + 251, contentWidth, 28),
      `Tech: ${this.getTechnician() || 'unavailable'}`,
      16
    );
    overlay.addSubview(technician);
    const appIcon = this.iosAppIcon();
    if (appIcon) {
      const iconView = UIImageView.alloc().initWithFrame(
        CGRectMake(bounds.size.width - 142, bounds.size.height - 31, 24, 24)
      );
      iconView.image = appIcon;
      iconView.contentMode = UIViewContentMode.ScaleAspectFit;
      iconView.layer.cornerRadius = 5;
      iconView.layer.masksToBounds = true;
      overlay.addSubview(iconView);
    }
    const credit = this.makeOverlayLabel(
      CGRectMake(bounds.size.width - 114, bounds.size.height - 29, 96, 22),
      'Photo by CCTec',
      12
    );
    credit.textAlignment = NSTextAlignment.Right;
    overlay.addSubview(credit);
    picker.cameraOverlayView = overlay;
    return coordinates;
  }

  private makeOverlayLabel(
    frame: CGRect,
    text: string,
    fontSize: number,
    color = UIColor.whiteColor
  ): UILabel {
    const label = UILabel.alloc().initWithFrame(frame);
    label.backgroundColor = UIColor.clearColor;
    label.textColor = color;
    label.font = UIFont.systemFontOfSize(fontSize);
    label.text = text;
    label.layer.shadowColor = UIColor.blackColor.CGColor;
    label.layer.shadowOpacity = 0.9;
    label.layer.shadowRadius = 2;
    label.layer.shadowOffset = CGSizeMake(1, 1);
    return label;
  }

  private getVisibleIosViewController(): UIViewController | null {
    const application = UIApplication.sharedApplication;
    const keyWindow = application.keyWindow ||
      (application.windows?.count ? application.windows.objectAtIndex(0) : null);
    const rootViewController = keyWindow?.rootViewController;
    return rootViewController ? Utils.ios.getVisibleViewController(rootViewController) : null;
  }

  private async requestLocationPermission(): Promise<void> {
    try {
      await geolocation.enableLocationRequest(false, true);
    } catch {
      // Location is optional; the order address will still be stamped.
    }
  }

  private async getLocation(): Promise<geolocation.Location | null> {
    try {
      const location = await Promise.race<geolocation.Location | null>([
        geolocation.getCurrentLocation({
          desiredAccuracy: CoreTypes.Accuracy.high,
          maximumAge: 5000,
          timeout: 8000,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 9000)),
      ]);
      console.log(
        '[EzeeTimestampCamera] Location resolved',
        location ? `${location.latitude},${location.longitude}` : 'unavailable'
      );
      return location;
    } catch {
      console.log('[EzeeTimestampCamera] Location unavailable');
      return null;
    }
  }

  private buildStampLines(
    order: EzeeOrderListItem,
    capturedAt: Date,
    location: geolocation.Location | null
  ): string[] {
    const coordinates = location
      ? `GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}  ±${Math.round(location.horizontalAccuracy || 0)}m`
      : 'GPS unavailable';
    const technician = this.getTechnician();
    return [
      this.formatDateTime(capturedAt),
      this.formatAddress(order?.address),
      coordinates,
      `Order #: ${String(order?.number || 'n/a')}`,
      `Tech: ${technician || 'unavailable'}`,
    ];
  }

  private getTechnician(): string {
    try {
      const user = JSON.parse(ApplicationSettings.getString('user', '{}'));
      const name = [user?.name, user?.lastname]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' ');
      const techId = String(user?.techCode || user?.techNumber || '').trim();
      return name && techId ? `${techId} - ${name}` : techId || name;
    } catch {
      return '';
    }
  }

  private formatDateTime(value: Date): string {
    return value.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private timeParts(value: Date): { time: string; meridiem: string } {
    const hour = value.getHours();
    return {
      time: `${hour % 12 || 12}:${String(value.getMinutes()).padStart(2, '0')}`,
      meridiem: hour >= 12 ? 'PM' : 'AM',
    };
  }

  private dateText(value: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[value.getMonth()]} ${value.getDate()}, ${value.getFullYear()}`;
  }

  private weekdayText(value: Date): string {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][value.getDay()];
  }

  private coordinateText(location: geolocation.Location | null | undefined): string {
    if (location === undefined) {
      return 'Coordinate: locating…';
    }
    if (!location) {
      return 'Coordinate: unavailable';
    }
    return `Coordinate: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  private formatAddress(value: unknown): string {
    return String(value || 'Address unavailable')
      .replace(/\b(\d{5})-\d{4}\b/g, '$1')
      .replace(/-\s*$/, '')
      .trim();
  }

  private iosAppIcon(): UIImage | null {
    return UIImage.imageNamed('AppIcon60x60') ||
      UIImage.imageNamed('AppIcon') ||
      UIImage.imageNamed('AppIcon60x60@2x');
  }

  private iosEzeeLogo(): UIImage | null {
    return UIImage.imageNamed('EzeeLogo');
  }

  private stampAndroid(source: ImageSource, rawLines: string[]): ImageSource {
    const original = source.android as android.graphics.Bitmap;
    const bitmap = original.copy(android.graphics.Bitmap.Config.ARGB_8888, true);
    const canvas = new android.graphics.Canvas(bitmap);
    const width = bitmap.getWidth();
    const height = bitmap.getHeight();
    const padding = Math.max(28, Math.round(width * 0.025));
    const textSize = Math.max(28, width * 0.032);
    const paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
    paint.setTextSize(textSize);
    paint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
    const lines = this.wrapLines(rawLines, width - (padding * 2), (text) => paint.measureText(text));
    const lineHeight = textSize * 1.35;
    const panelHeight = (padding * 2) + (lines.length * lineHeight);
    const panelTop = Math.max(0, height - panelHeight);

    paint.setColor(android.graphics.Color.argb(185, 0, 0, 0));
    canvas.drawRect(0, panelTop, width, height, paint);
    paint.setColor(android.graphics.Color.WHITE);
    lines.forEach((line, index) => {
      canvas.drawText(line, padding, panelTop + padding + textSize + (index * lineHeight), paint);
    });
    return new ImageSource(bitmap);
  }

  private stampIos(
    source: ImageSource,
    order: EzeeOrderListItem,
    capturedAt: Date,
    location: geolocation.Location | null
  ): ImageSource {
    const image = source.ios as UIImage;
    const size = image.size;
    const width = size.width;
    const height = size.height;
    const scale = width / 1200;
    const left = 34 * scale;
    const bottom = 34 * scale;
    const panelHeight = 430 * scale;
    const panelTop = Math.max(0, height - panelHeight - bottom);
    const timeParts = this.timeParts(capturedAt);
    const technician = this.getTechnician() || 'Technician unavailable';

    const drawText = (
      text: string,
      rect: CGRect,
      font: UIFont,
      color = UIColor.whiteColor,
      alignment = NSTextAlignment.Left
    ) => {
      const paragraph = NSMutableParagraphStyle.new();
      paragraph.alignment = alignment;
      paragraph.lineBreakMode = NSLineBreakMode.ByWordWrapping;
      const attributes = NSDictionary.dictionaryWithObjectsForKeys<string, any>(
        [font, color, paragraph],
        [NSFontAttributeName, NSForegroundColorAttributeName, NSParagraphStyleAttributeName]
      );
      const shadowRect = CGRectMake(rect.origin.x + (2 * scale), rect.origin.y + (2 * scale), rect.size.width, rect.size.height);
      const shadowAttributes = NSDictionary.dictionaryWithObjectsForKeys<string, any>(
        [font, UIColor.colorWithWhiteAlpha(0, 0.9), paragraph],
        [NSFontAttributeName, NSForegroundColorAttributeName, NSParagraphStyleAttributeName]
      );
      NSString.stringWithString(text).drawInRectWithAttributes(shadowRect, shadowAttributes);
      NSString.stringWithString(text).drawInRectWithAttributes(rect, attributes);
    };

    UIGraphicsBeginImageContextWithOptions(size, false, image.scale);
    image.drawInRect(CGRectMake(0, 0, width, height));

    UIColor.colorWithWhiteAlpha(1, 0.92).setFill();
    UIBezierPath.bezierPathWithRoundedRectCornerRadius(
      CGRectMake(left, panelTop, 250 * scale, 100 * scale),
      14 * scale
    ).fill();
    this.iosEzeeLogo()?.drawInRect(
      CGRectMake(left + (12 * scale), panelTop + (12 * scale), 226 * scale, 76 * scale)
    );

    const timeY = panelTop + (112 * scale);
    drawText(
      timeParts.time,
      CGRectMake(left, timeY, 270 * scale, 112 * scale),
      UIFont.systemFontOfSizeWeight(104 * scale, UIFontWeightLight)
    );
    drawText(
      timeParts.meridiem,
      CGRectMake(left + (270 * scale), timeY + (7 * scale), 70 * scale, 40 * scale),
      UIFont.systemFontOfSize(31 * scale)
    );
    UIColor.colorWithRedGreenBlueAlpha(1, 0.71, 0.05, 1).setFill();
    UIRectFill(CGRectMake(left + (350 * scale), timeY + (6 * scale), 5 * scale, 102 * scale));
    drawText(
      this.dateText(capturedAt),
      CGRectMake(left + (375 * scale), timeY + (4 * scale), 450 * scale, 52 * scale),
      UIFont.systemFontOfSize(39 * scale)
    );
    drawText(
      this.weekdayText(capturedAt),
      CGRectMake(left + (375 * scale), timeY + (58 * scale), 220 * scale, 48 * scale),
      UIFont.systemFontOfSize(37 * scale)
    );

    const detailsY = panelTop + (235 * scale);
    drawText(
      this.formatAddress(order?.address),
      CGRectMake(left, detailsY, width - (left * 2), 48 * scale),
      UIFont.systemFontOfSize(27 * scale)
    );
    drawText(
      this.coordinateText(location),
      CGRectMake(left, detailsY + (50 * scale), width - (left * 2), 40 * scale),
      UIFont.systemFontOfSize(27 * scale)
    );
    drawText(
      `Order #: ${String(order?.number || 'n/a')}`,
      CGRectMake(left, detailsY + (96 * scale), 430 * scale, 38 * scale),
      UIFont.systemFontOfSize(28 * scale)
    );
    drawText(
      `Tech: ${technician}`,
      CGRectMake(left, detailsY + (140 * scale), width - (left * 2), 40 * scale),
      UIFont.systemFontOfSize(29 * scale)
    );
    const appIcon = this.iosAppIcon();
    if (appIcon) {
      appIcon.drawInRect(
        CGRectMake(width - (310 * scale), height - (48 * scale), 36 * scale, 36 * scale)
      );
    }
    drawText(
      'Photo by CCTec',
      CGRectMake(width - (264 * scale), height - (46 * scale), 230 * scale, 38 * scale),
      UIFont.systemFontOfSize(25 * scale),
      UIColor.whiteColor,
      NSTextAlignment.Right
    );
    const stamped = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    if (!stamped) {
      throw new Error('Unable to apply the timestamp to the photo.');
    }
    return new ImageSource(stamped);
  }

  private wrapLines(
    rawLines: string[],
    maxWidth: number,
    measure: (value: string) => number
  ): string[] {
    const lines: string[] = [];
    rawLines.forEach((rawLine) => {
      const words = String(rawLine || '').trim().split(/\s+/).filter(Boolean);
      if (!words.length) {
        return;
      }
      let current = words.shift() || '';
      words.forEach((word) => {
        const candidate = `${current} ${word}`;
        if (measure(candidate) <= maxWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = word;
        }
      });
      lines.push(current);
    });
    return lines;
  }

  private safeFilePart(value: unknown): string {
    return String(value || 'order').replace(/[^A-Z0-9_-]/gi, '_');
  }

  private fileTimestamp(value: Date): string {
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
  }
}
