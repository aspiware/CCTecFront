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

declare const CIImage: any;
declare const CIContext: any;

type IosPhotoAspectMode = 'full' | '4:3';

@Injectable({ providedIn: 'root' })
export class EzeeTimestampCameraService {
  private iosCameraDelegate?: UIImagePickerControllerDelegate & UINavigationControllerDelegate;
  private iosPhotoCaptureDelegate?: AVCapturePhotoCaptureDelegate;
  private iosCoordinateLabel?: UILabel;
  private locationWatchId?: number;
  private locationWatchStarting?: Promise<number>;
  private locationSession = 0;
  private latestLocation?: geolocation.Location;
  private iosClockTimer?: ReturnType<typeof setInterval>;
  private iosTimeLabel?: UILabel;
  private iosMeridiemLabel?: UILabel;
  private iosDateLabel?: UILabel;
  private iosWeekdayLabel?: UILabel;

  public async captureContinuous(order: EzeeOrderListItem): Promise<number> {
    if (!isIOS || !camera.isAvailable()) {
      throw new Error('Continuous camera mode is not available on this device.');
    }

    const cameraPermission = await camera.requestCameraPermissions();
    if (!cameraPermission?.Success) {
      throw new Error('Camera permission is required to capture order photos.');
    }
    const photosPermission = await camera.requestPhotosPermissions();
    if (!photosPermission?.Success) {
      throw new Error('Photo library permission is required for continuous photos.');
    }

    await this.requestLocationPermission();
    const locationSession = ++this.locationSession;
    this.latestLocation = undefined;
    const locationPromise = this.getLocation().then((location) => {
      if (location && locationSession === this.locationSession) {
        this.applyTrackedLocation(location);
      }
      return location;
    });
    this.startLocationTracking(locationSession);
    try {
      return await this.takeContinuousIosPhotos(order, locationPromise);
    } finally {
      this.stopLocationTracking(locationSession);
    }
  }

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
    const locationSession = ++this.locationSession;
    this.latestLocation = undefined;
    const locationPromise = this.getLocation().then((location) => {
      if (location && locationSession === this.locationSession) {
        this.applyTrackedLocation(location);
      }
      return location;
    });
    if (isIOS) {
      this.startLocationTracking(locationSession);
    }

    try {
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
      const location = this.latestLocation || await locationPromise;
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
    } finally {
      this.stopLocationTracking(locationSession);
    }
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
        this.configureIosCameraAspectFill(picker);
        const coordinateLabel = this.createIosCameraOverlay(picker, order);
        this.iosCoordinateLabel = coordinateLabel;
        if (this.latestLocation) {
          coordinateLabel.text = this.coordinateText(this.latestLocation);
        }
        void locationPromise.then((location) => {
          if (!this.latestLocation) {
            Utils.executeOnMainThread(() => {
              coordinateLabel.text = this.coordinateText(location);
            });
          }
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
    const result = this.buildIosCameraOverlay(picker.view.bounds, order);
    picker.cameraOverlayView = result.overlay;
    return result.coordinateLabel;
  }

  private buildIosCameraOverlay(
    bounds: CGRect,
    order: EzeeOrderListItem
  ): { overlay: UIView; coordinateLabel: UILabel } {
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
    this.startIosClock(time, meridiem, date, weekday);

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
    const credit = this.makeOverlayLabel(
      CGRectMake(0, 0, 1, 22),
      'Photo by CCTec',
      12
    );
    credit.textAlignment = NSTextAlignment.Left;
    credit.sizeToFit();
    const creditWidth = credit.frame.size.width;
    const creditX = bounds.size.width - 18 - creditWidth;
    credit.frame = CGRectMake(creditX, bounds.size.height - 29, creditWidth, 22);
    const appIcon = this.iosAppIcon();
    if (appIcon) {
      const iconView = UIImageView.alloc().initWithFrame(
        CGRectMake(creditX - 28, bounds.size.height - 31, 24, 24)
      );
      iconView.image = appIcon;
      iconView.contentMode = UIViewContentMode.ScaleAspectFit;
      iconView.layer.cornerRadius = 5;
      iconView.layer.masksToBounds = true;
      overlay.addSubview(iconView);
    }
    overlay.addSubview(credit);
    return { overlay, coordinateLabel: coordinates };
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

  private takeContinuousIosPhotos(
    order: EzeeOrderListItem,
    locationPromise: Promise<geolocation.Location | null>
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        const visibleViewController = this.getVisibleIosViewController();
        if (!visibleViewController) {
          reject(new Error('Unable to present the continuous camera.'));
          return;
        }

        const controller = UIViewController.new();
        controller.modalPresentationStyle = UIModalPresentationStyle.FullScreen;
        controller.view.backgroundColor = UIColor.blackColor;
        const bounds = UIScreen.mainScreen.bounds;
        controller.view.frame = bounds;

        const session = AVCaptureSession.new();
        session.sessionPreset = AVCaptureSessionPresetPhoto;
        const device = AVCaptureDevice.defaultDeviceWithMediaType(AVMediaTypeVideo);
        if (!device) {
          reject(new Error('Rear camera is not available.'));
          return;
        }
        const inputError = new interop.Reference<NSError>();
        const input = AVCaptureDeviceInput.deviceInputWithDeviceError(device, inputError);
        if (!input || !session.canAddInput(input)) {
          reject(new Error(inputError.value?.localizedDescription || 'Unable to configure camera input.'));
          return;
        }
        session.addInput(input);

        const photoOutput = AVCapturePhotoOutput.new();
        if (!session.canAddOutput(photoOutput)) {
          reject(new Error('Unable to configure photo capture.'));
          return;
        }
        session.addOutput(photoOutput);
        photoOutput.highResolutionCaptureEnabled = true;
        photoOutput.maxPhotoQualityPrioritization = AVCapturePhotoQualityPrioritization.Quality;

        const previewLayer = AVCaptureVideoPreviewLayer.layerWithSession(session);
        let aspectMode = this.savedIosPhotoAspectMode();
        let captureAspectMode = aspectMode;
        const applyAspectMode = (mode: IosPhotoAspectMode) => {
          aspectMode = mode;
          ApplicationSettings.setString('ezee-camera-aspect-mode', mode);
          if (mode === '4:3') {
            const previewHeight = bounds.size.width * (4 / 3);
            previewLayer.frame = CGRectMake(
              0,
              (bounds.size.height - previewHeight) / 2,
              bounds.size.width,
              previewHeight
            );
          } else {
            previewLayer.frame = bounds;
          }
          previewLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;
        };
        applyAspectMode(aspectMode);
        this.configureIosCaptureConnection(previewLayer.connection);
        this.configureIosCaptureConnection(photoOutput.connectionWithMediaType(AVMediaTypeVideo));
        controller.view.layer.addSublayer(previewLayer);

        const overlayResult = this.buildIosCameraOverlay(bounds, order);
        const overlay = overlayResult.overlay;
        const coordinateLabel = overlayResult.coordinateLabel;
        this.iosCoordinateLabel = coordinateLabel;
        if (this.latestLocation) {
          coordinateLabel.text = this.coordinateText(this.latestLocation);
        }
        void locationPromise.then((location) => {
          if (!this.latestLocation) {
            Utils.executeOnMainThread(() => {
              coordinateLabel.text = this.coordinateText(location);
            });
          }
        });
        overlay.userInteractionEnabled = true;
        controller.view.addSubview(overlay);
        const countLabel = this.makeOverlayLabel(
          CGRectMake((bounds.size.width - 180) / 2, 44, 180, 30),
          '0 photos saved',
          16
        );
        countLabel.textAlignment = NSTextAlignment.Center;
        overlay.addSubview(countLabel);

        const formatControl = UISegmentedControl.alloc().initWithItems(['Full', '4:3']);
        formatControl.frame = CGRectMake((bounds.size.width - 150) / 2, 82, 150, 34);
        formatControl.selectedSegmentIndex = aspectMode === '4:3' ? 1 : 0;
        formatControl.selectedSegmentTintColor = UIColor.whiteColor;
        formatControl.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.5);
        formatControl.setTitleTextAttributesForState(
          NSDictionary.dictionaryWithObjectsForKeys(
            [UIColor.whiteColor, UIFont.boldSystemFontOfSize(14)],
            [NSForegroundColorAttributeName, NSFontAttributeName]
          ),
          UIControlState.Normal
        );
        formatControl.setTitleTextAttributesForState(
          NSDictionary.dictionaryWithObjectsForKeys(
            [UIColor.blackColor, UIFont.boldSystemFontOfSize(14)],
            [NSForegroundColorAttributeName, NSFontAttributeName]
          ),
          UIControlState.Selected
        );
        formatControl.addActionForControlEvents(
          UIAction.actionWithHandler(() => {
            applyAspectMode(formatControl.selectedSegmentIndex === 1 ? '4:3' : 'full');
          }),
          UIControlEvents.ValueChanged
        );
        overlay.addSubview(formatControl);

        let photoCount = 0;
        let lastPhotoPath = '';
        let isCapturing = false;
        let isFinished = false;
        const finish = () => {
          if (isFinished || isCapturing) {
            return;
          }
          isFinished = true;
          session.stopRunning();
          controller.dismissViewControllerAnimatedCompletion(true, () => {
            this.iosPhotoCaptureDelegate = undefined;
            resolve(photoCount);
          });
        };

        const thumbnailButton = UIButton.buttonWithType(UIButtonType.Custom);
        thumbnailButton.frame = CGRectMake(16, bounds.size.height - 104, 72, 72);
        thumbnailButton.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.5);
        thumbnailButton.layer.cornerRadius = 10;
        thumbnailButton.layer.borderColor = UIColor.whiteColor.CGColor;
        thumbnailButton.layer.borderWidth = 2;
        thumbnailButton.layer.masksToBounds = true;
        thumbnailButton.imageView.contentMode = UIViewContentMode.ScaleAspectFill;
        thumbnailButton.hidden = true;
        thumbnailButton.addActionForControlEvents(
          UIAction.actionWithHandler(() => {
            if (lastPhotoPath && !isCapturing) {
              this.presentContinuousPhotoPreview(controller, lastPhotoPath);
            }
          }),
          UIControlEvents.TouchUpInside
        );
        overlay.addSubview(thumbnailButton);

        const doneButton = UIButton.buttonWithType(UIButtonType.System);
        doneButton.frame = CGRectMake(bounds.size.width - 88, bounds.size.height - 102, 72, 44);
        doneButton.setTitleForState('Done', UIControlState.Normal);
        doneButton.setTitleColorForState(UIColor.whiteColor, UIControlState.Normal);
        doneButton.titleLabel.font = UIFont.boldSystemFontOfSize(17);
        doneButton.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.55);
        doneButton.layer.cornerRadius = 12;
        doneButton.addActionForControlEvents(
          UIAction.actionWithHandler(() => finish()),
          UIControlEvents.TouchUpInside
        );
        overlay.addSubview(doneButton);

        const cancelButton = UIButton.buttonWithType(UIButtonType.System);
        cancelButton.frame = CGRectMake(16, 42, 76, 40);
        cancelButton.setTitleForState('Cancel', UIControlState.Normal);
        cancelButton.setTitleColorForState(UIColor.whiteColor, UIControlState.Normal);
        cancelButton.titleLabel.font = UIFont.boldSystemFontOfSize(16);
        cancelButton.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.45);
        cancelButton.layer.cornerRadius = 10;
        cancelButton.addActionForControlEvents(
          UIAction.actionWithHandler(() => finish()),
          UIControlEvents.TouchUpInside
        );
        overlay.addSubview(cancelButton);

        const shutter = UIButton.buttonWithType(UIButtonType.Custom);
        shutter.frame = CGRectMake((bounds.size.width - 72) / 2, bounds.size.height - 104, 72, 72);
        shutter.backgroundColor = UIColor.whiteColor;
        shutter.layer.cornerRadius = 36;
        shutter.layer.borderColor = UIColor.colorWithWhiteAlpha(1, 0.7).CGColor;
        shutter.layer.borderWidth = 5;
        shutter.addActionForControlEvents(
          UIAction.actionWithHandler(() => {
            if (isFinished || isCapturing) {
              return;
            }
            isCapturing = true;
            captureAspectMode = aspectMode;
            shutter.alpha = 0.45;
            const settings = AVCapturePhotoSettings.photoSettings();
            settings.highResolutionPhotoEnabled = true;
            settings.photoQualityPrioritization = AVCapturePhotoQualityPrioritization.Quality;
            photoOutput.capturePhotoWithSettingsDelegate(
              settings,
              this.iosPhotoCaptureDelegate!
            );
          }),
          UIControlEvents.TouchUpInside
        );
        overlay.addSubview(shutter);

        const owner = new WeakRef(this);
        const DelegateClass = (NSObject as any).extend(
          {
            captureOutputDidFinishProcessingPhotoError(
              _output: AVCapturePhotoOutput,
              photo: AVCapturePhoto,
              error: NSError
            ) {
              const service = owner.deref();
              const data = !error ? photo?.fileDataRepresentation() : null;
              const image = data ? UIImage.imageWithData(data) : null;
              if (!service || !image || error) {
                if (error) {
                  console.log('[EzeeTimestampCamera] Photo capture failed', error);
                }
                isCapturing = false;
                shutter.alpha = 1;
                return;
              }
              void service.saveContinuousIosPhoto(new ImageSource(image), order, captureAspectMode)
                .then((filePath) => {
                  photoCount += 1;
                  lastPhotoPath = filePath;
                  Utils.executeOnMainThread(() => {
                    countLabel.text = `${photoCount} photo${photoCount === 1 ? '' : 's'} saved`;
                    const thumbnail = ImageSource.fromFileSync(filePath);
                    thumbnailButton.setImageForState(thumbnail?.ios || null, UIControlState.Normal);
                    thumbnailButton.hidden = false;
                  });
                })
                .catch((error) => {
                  console.log('[EzeeTimestampCamera] Unable to save continuous photo', error);
                  Utils.executeOnMainThread(() => {
                    countLabel.text = 'Unable to save photo';
                  });
                })
                .finally(() => {
                  Utils.executeOnMainThread(() => {
                    isCapturing = false;
                    shutter.alpha = 1;
                  });
                });
            },
          },
          {
            protocols: [AVCapturePhotoCaptureDelegate],
            name: `EzeeContinuousPhotoCaptureDelegate${Date.now()}`,
          }
        );

        this.iosPhotoCaptureDelegate = DelegateClass.new();
        visibleViewController.presentViewControllerAnimatedCompletion(controller, true, () => {
          session.startRunning();
        });
      } catch (error) {
        this.iosPhotoCaptureDelegate = undefined;
        reject(error);
      }
    });
  }

  private async saveContinuousIosPhoto(
    source: ImageSource,
    order: EzeeOrderListItem,
    aspectMode: IosPhotoAspectMode
  ): Promise<string> {
    const capturedAt = new Date();
    const cropped = this.prepareIosImageForAspect(source, aspectMode);
    const stamped = this.stampIos(cropped, order, capturedAt, this.latestLocation || null);
    const folder = knownFolders.documents().getFolder('ezee-timestamp-photos');
    const fileName = `ezee-${this.safeFilePart(order.number)}-${this.fileTimestamp(capturedAt)}.jpg`;
    const filePath = path.join(folder.path, fileName);
    if (!stamped.saveToFile(filePath, 'jpg', 92)) {
      throw new Error('Unable to save the timestamped photo.');
    }
    await new Promise<void>((resolve, reject) => {
      PHPhotoLibrary.sharedPhotoLibrary().performChangesCompletionHandler(
        () => {
          PHAssetChangeRequest.creationRequestForAssetFromImage(stamped.ios);
        },
        (success, error) => success ? resolve() : reject(error)
      );
    });
    return filePath;
  }

  private prepareIosImageForAspect(
    source: ImageSource,
    aspectMode: IosPhotoAspectMode
  ): ImageSource {
    const original = source.ios as UIImage;
    const originalCgImage = original.CGImage;
    if (!originalCgImage) {
      return source;
    }
    let image = CIImage.imageWithCGImage(originalCgImage)
      .imageByApplyingCGOrientation(this.exifOrientation(original.imageOrientation));
    const extent = image.extent;
    let cropRect = extent;
    if (aspectMode === 'full') {
      const previewSize = UIScreen.mainScreen.bounds.size;
      const previewAspect = previewSize.width / previewSize.height;
      const sourceAspect = extent.size.width / extent.size.height;
      let cropWidth = extent.size.width;
      let cropHeight = extent.size.height;
      if (sourceAspect > previewAspect) {
        cropWidth = cropHeight * previewAspect;
      } else {
        cropHeight = cropWidth / previewAspect;
      }
      cropRect = CGRectMake(
        extent.origin.x + ((extent.size.width - cropWidth) / 2),
        extent.origin.y + ((extent.size.height - cropHeight) / 2),
        cropWidth,
        cropHeight
      );
    }
    image = image.imageByCroppingToRect(cropRect);

    const renderedExtent = image.extent;
    const rendered = CIContext.context().createCGImageFromRect(image, renderedExtent);
    if (!rendered) {
      return source;
    }
    const cropped = UIImage.imageWithCGImageScaleOrientation(
      rendered,
      1,
      UIImageOrientation.Up
    );
    console.log(
      `[EzeeTimestampCamera] Prepared ${aspectMode} photo`,
      `${Math.round(renderedExtent.size.width)}x${Math.round(renderedExtent.size.height)}`
    );
    return new ImageSource(cropped);
  }

  private savedIosPhotoAspectMode(): IosPhotoAspectMode {
    return ApplicationSettings.getString('ezee-camera-aspect-mode', 'full') === '4:3'
      ? '4:3'
      : 'full';
  }

  private exifOrientation(orientation: UIImageOrientation): CGImagePropertyOrientation {
    switch (orientation) {
      case UIImageOrientation.Down:
        return CGImagePropertyOrientation.kCGImagePropertyOrientationDown;
      case UIImageOrientation.Left:
        return CGImagePropertyOrientation.kCGImagePropertyOrientationLeft;
      case UIImageOrientation.Right:
        return CGImagePropertyOrientation.kCGImagePropertyOrientationRight;
      case UIImageOrientation.UpMirrored:
        return CGImagePropertyOrientation.kCGImagePropertyOrientationUpMirrored;
      case UIImageOrientation.DownMirrored:
        return CGImagePropertyOrientation.kCGImagePropertyOrientationDownMirrored;
      case UIImageOrientation.LeftMirrored:
        return CGImagePropertyOrientation.kCGImagePropertyOrientationLeftMirrored;
      case UIImageOrientation.RightMirrored:
        return CGImagePropertyOrientation.kCGImagePropertyOrientationRightMirrored;
      default:
        return CGImagePropertyOrientation.kCGImagePropertyOrientationUp;
    }
  }

  private presentContinuousPhotoPreview(
    cameraController: UIViewController,
    filePath: string
  ): void {
    const source = ImageSource.fromFileSync(filePath);
    if (!source?.ios) {
      return;
    }

    const preview = UIViewController.new();
    preview.modalPresentationStyle = UIModalPresentationStyle.FullScreen;
    preview.view.backgroundColor = UIColor.blackColor;
    const bounds = UIScreen.mainScreen.bounds;
    const imageView = UIImageView.alloc().initWithFrame(bounds);
    imageView.image = source.ios;
    imageView.contentMode = UIViewContentMode.ScaleAspectFit;
    imageView.autoresizingMask = UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;
    preview.view.addSubview(imageView);

    const closeButton = UIButton.buttonWithType(UIButtonType.System);
    closeButton.frame = CGRectMake(18, 48, 72, 42);
    closeButton.setTitleForState('Close', UIControlState.Normal);
    closeButton.setTitleColorForState(UIColor.whiteColor, UIControlState.Normal);
    closeButton.titleLabel.font = UIFont.boldSystemFontOfSize(17);
    closeButton.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.55);
    closeButton.layer.cornerRadius = 11;
    closeButton.addActionForControlEvents(
      UIAction.actionWithHandler(() => {
        preview.dismissViewControllerAnimatedCompletion(true, null);
      }),
      UIControlEvents.TouchUpInside
    );
    preview.view.addSubview(closeButton);

    const shareButton = UIButton.buttonWithType(UIButtonType.System);
    shareButton.frame = CGRectMake(bounds.size.width - 90, 48, 72, 42);
    shareButton.setTitleForState('Share', UIControlState.Normal);
    shareButton.setTitleColorForState(UIColor.whiteColor, UIControlState.Normal);
    shareButton.titleLabel.font = UIFont.boldSystemFontOfSize(17);
    shareButton.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.55);
    shareButton.layer.cornerRadius = 11;
    shareButton.addActionForControlEvents(
      UIAction.actionWithHandler(() => {
        const fileUrl = NSURL.fileURLWithPath(filePath);
        const activity = UIActivityViewController.alloc()
          .initWithActivityItemsApplicationActivities([fileUrl], []);
        const popover = activity.popoverPresentationController;
        if (popover) {
          popover.sourceView = shareButton;
          popover.sourceRect = shareButton.bounds;
          popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
        }
        preview.presentViewControllerAnimatedCompletion(activity, true, null);
      }),
      UIControlEvents.TouchUpInside
    );
    preview.view.addSubview(shareButton);
    cameraController.presentViewControllerAnimatedCompletion(preview, true, null);
  }

  private getVisibleIosViewController(): UIViewController | null {
    const application = UIApplication.sharedApplication;
    const keyWindow = application.keyWindow ||
      (application.windows?.count ? application.windows.objectAtIndex(0) : null);
    const rootViewController = keyWindow?.rootViewController;
    return rootViewController ? Utils.ios.getVisibleViewController(rootViewController) : null;
  }

  private configureIosCameraAspectFill(picker: UIImagePickerController): void {
    const screenSize = UIScreen.mainScreen.bounds.size;
    const nativePreviewHeight = screenSize.width * (4 / 3);
    const scale = Math.max(1, screenSize.height / nativePreviewHeight);
    picker.cameraViewTransform = CGAffineTransformMakeScale(scale, scale);
  }

  private configureIosCaptureConnection(connection: AVCaptureConnection | null): void {
    if (!connection) {
      return;
    }
    const compatibleConnection = connection as any;
    if (
      typeof compatibleConnection.isVideoRotationAngleSupported === 'function' &&
      compatibleConnection.isVideoRotationAngleSupported(90)
    ) {
      compatibleConnection.videoRotationAngle = 90;
      return;
    }
    compatibleConnection.videoOrientation = AVCaptureVideoOrientation.Portrait;
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

  private startLocationTracking(locationSession: number): void {
    const starting = geolocation.watchLocation(
      (location) => {
        if (locationSession === this.locationSession) {
          this.applyTrackedLocation(location);
        }
      },
      (error) => {
        console.log('[EzeeTimestampCamera] Live location update failed', error);
      },
      {
        desiredAccuracy: CoreTypes.Accuracy.high,
        updateDistance: 1,
        updateTime: 1000,
        minimumUpdateTime: 1000,
        maximumAge: 1000,
        iosPausesLocationUpdatesAutomatically: false,
      }
    );
    this.locationWatchStarting = starting;
    void starting.then((watchId) => {
      if (locationSession !== this.locationSession) {
        geolocation.clearWatch(watchId);
        return;
      }
      this.locationWatchId = watchId;
      console.log('[EzeeTimestampCamera] Live location tracking started');
    }).catch((error) => {
      console.log('[EzeeTimestampCamera] Unable to start live location tracking', error);
    }).finally(() => {
      if (this.locationWatchStarting === starting) {
        this.locationWatchStarting = undefined;
      }
    });
  }

  private applyTrackedLocation(location: geolocation.Location): void {
    this.latestLocation = location;
    const coordinateLabel = this.iosCoordinateLabel;
    if (coordinateLabel) {
      Utils.executeOnMainThread(() => {
        coordinateLabel.text = this.coordinateText(location);
      });
    }
  }

  private stopLocationTracking(locationSession: number): void {
    if (locationSession !== this.locationSession) {
      return;
    }
    this.locationSession += 1;
    this.iosCoordinateLabel = undefined;
    this.stopIosClock();
    if (this.locationWatchId !== undefined) {
      geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = undefined;
    }
    this.locationWatchStarting = undefined;
    console.log('[EzeeTimestampCamera] Live location tracking stopped');
  }

  private startIosClock(
    timeLabel: UILabel,
    meridiemLabel: UILabel,
    dateLabel: UILabel,
    weekdayLabel: UILabel
  ): void {
    this.stopIosClock();
    this.iosTimeLabel = timeLabel;
    this.iosMeridiemLabel = meridiemLabel;
    this.iosDateLabel = dateLabel;
    this.iosWeekdayLabel = weekdayLabel;
    const update = () => {
      const now = new Date();
      const time = this.timeParts(now);
      if (this.iosTimeLabel) {
        this.iosTimeLabel.text = time.time;
      }
      if (this.iosMeridiemLabel) {
        this.iosMeridiemLabel.text = time.meridiem;
      }
      if (this.iosDateLabel) {
        this.iosDateLabel.text = this.dateText(now);
      }
      if (this.iosWeekdayLabel) {
        this.iosWeekdayLabel.text = this.weekdayText(now);
      }
    };
    update();
    this.iosClockTimer = setInterval(update, 1000);
    console.log('[EzeeTimestampCamera] Live clock started');
  }

  private stopIosClock(): void {
    if (this.iosClockTimer !== undefined) {
      clearInterval(this.iosClockTimer);
      this.iosClockTimer = undefined;
      console.log('[EzeeTimestampCamera] Live clock stopped');
    }
    this.iosTimeLabel = undefined;
    this.iosMeridiemLabel = undefined;
    this.iosDateLabel = undefined;
    this.iosWeekdayLabel = undefined;
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
      CGRectMake(left, timeY, 300 * scale, 126 * scale),
      UIFont.systemFontOfSizeWeight(112 * scale, UIFontWeightLight)
    );
    drawText(
      timeParts.meridiem,
      CGRectMake(left + (270 * scale), timeY + (7 * scale), 70 * scale, 40 * scale),
      UIFont.systemFontOfSize(34 * scale)
    );
    UIColor.colorWithRedGreenBlueAlpha(1, 0.71, 0.05, 1).setFill();
    UIRectFill(CGRectMake(left + (350 * scale), timeY + (6 * scale), 5 * scale, 102 * scale));
    drawText(
      this.dateText(capturedAt),
      CGRectMake(left + (375 * scale), timeY + (4 * scale), 450 * scale, 52 * scale),
      UIFont.systemFontOfSize(43 * scale)
    );
    drawText(
      this.weekdayText(capturedAt),
      CGRectMake(left + (375 * scale), timeY + (58 * scale), 220 * scale, 48 * scale),
      UIFont.systemFontOfSize(41 * scale)
    );

    const detailsY = panelTop + (235 * scale);
    drawText(
      this.formatAddress(order?.address),
      CGRectMake(left, detailsY, width - (left * 2), 48 * scale),
      UIFont.systemFontOfSize(30 * scale)
    );
    drawText(
      this.coordinateText(location),
      CGRectMake(left, detailsY + (50 * scale), width - (left * 2), 40 * scale),
      UIFont.systemFontOfSize(30 * scale)
    );
    drawText(
      `Order #: ${String(order?.number || 'n/a')}`,
      CGRectMake(left, detailsY + (96 * scale), 430 * scale, 38 * scale),
      UIFont.systemFontOfSize(31 * scale)
    );
    drawText(
      `Tech: ${technician}`,
      CGRectMake(left, detailsY + (140 * scale), width - (left * 2), 40 * scale),
      UIFont.systemFontOfSize(32 * scale)
    );
    const creditText = NSString.stringWithString('Photo by CCTec');
    const creditFont = UIFont.systemFontOfSize(28 * scale);
    const creditAttributes = NSDictionary.dictionaryWithObjectsForKeys<string, any>(
      [creditFont, UIColor.whiteColor],
      [NSFontAttributeName, NSForegroundColorAttributeName]
    );
    const creditShadowAttributes = NSDictionary.dictionaryWithObjectsForKeys<string, any>(
      [creditFont, UIColor.colorWithWhiteAlpha(0, 0.9)],
      [NSFontAttributeName, NSForegroundColorAttributeName]
    );
    const creditSize = creditText.sizeWithAttributes(creditAttributes);
    const creditX = width - (90 * scale) - creditSize.width;
    const iconSize = 36 * scale;
    const creditBottom = 44 * scale;
    const creditY = height - creditBottom - creditSize.height;
    const appIcon = this.iosAppIcon();
    if (appIcon) {
      appIcon.drawInRect(
        CGRectMake(
          creditX - iconSize - (5 * scale),
          height - creditBottom - iconSize,
          iconSize,
          iconSize
        )
      );
    }
    creditText.drawAtPointWithAttributes(
      CGPointMake(creditX + (2 * scale), creditY + (2 * scale)),
      creditShadowAttributes
    );
    creditText.drawAtPointWithAttributes(
      CGPointMake(creditX, creditY),
      creditAttributes
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
