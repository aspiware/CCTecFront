import { Injectable } from '@angular/core';
import * as camera from '@nativescript/camera';
import * as geolocation from '@nativescript/geolocation';
import {
  ApplicationSettings,
  CoreTypes,
  File,
  GestureStateTypes,
  GesturesObserver,
  GestureTypes,
  ImageSource,
  isAndroid,
  isIOS,
  knownFolders,
  path,
  PinchGestureEventData,
  Utils,
} from '@nativescript/core';
import { EzeeOrderListItem } from './ezee-order.model';

declare const CIImage: any;
declare const CIContext: any;

type IosPhotoAspectMode = 'full' | '4:3';

export interface EzeeOrderPhoto {
  path: string;
  fileName: string;
  galleryAssetIdentifier?: string;
}

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
  private iosPinchZoomObserver?: GesturesObserver;

  public async captureContinuous(order: EzeeOrderListItem): Promise<number> {
    if (!isIOS || !camera.isAvailable()) {
      throw new Error('Continuous camera mode is not available on this device.');
    }

    const cameraPermission = await camera.requestCameraPermissions();
    if (!cameraPermission?.Success) {
      throw new Error('Camera permission is required to capture order photos.');
    }
    if (this.savedSaveToPhotosPreference()) {
      const photosPermission = await camera.requestPhotosPermissions();
      if (!photosPermission?.Success) {
        ApplicationSettings.setBoolean('ezee-camera-save-to-photos', false);
      }
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

  public getOrderPhotoPaths(orderNumber: string): string[] {
    return this.getOrderPhotos(orderNumber).map((photo) => photo.path);
  }

  public getOrderPhotos(orderNumber: string): EzeeOrderPhoto[] {
    const safeOrderNumber = this.safeFilePart(orderNumber);
    const orderFolder = knownFolders.documents()
      .getFolder('ezee-order-photos')
      .getFolder(safeOrderNumber);
    const legacyFolder = knownFolders.documents().getFolder('ezee-timestamp-photos');
    const legacyPrefix = `ezee-${safeOrderNumber}-`;
    const isPhoto = (filePath: string) => /\.(jpe?g|png)$/i.test(filePath);
    const manifest = this.readPhotoManifest(orderNumber);

    const orderPhotos = orderFolder.getEntitiesSync()
      .filter((entity) => File.exists(entity.path) && isPhoto(entity.path))
      .map((entity) => ({
        path: entity.path,
        fileName: entity.name,
        galleryAssetIdentifier: manifest[entity.name],
      }));
    const legacyPhotos = legacyFolder.getEntitiesSync()
      .filter((entity) => File.exists(entity.path) && entity.name.startsWith(legacyPrefix) && isPhoto(entity.path))
      .map((entity) => ({ path: entity.path, fileName: entity.name }));

    const photosByPath = new Map<string, EzeeOrderPhoto>();
    [...orderPhotos, ...legacyPhotos].forEach((photo) => photosByPath.set(photo.path, photo));
    return Array.from(photosByPath.values()).sort((a, b) => a.fileName.localeCompare(b.fileName));
  }

  public async deleteOrderPhotos(
    orderNumber: string,
    photos: EzeeOrderPhoto[],
    deleteFromPhotos: boolean
  ): Promise<{ deleted: number; galleryDeleted: number; unlinkedGalleryCopies: number }> {
    const selected = photos.filter((photo) => File.exists(photo.path));
    const galleryIdentifiers = deleteFromPhotos
      ? selected.map((photo) => photo.galleryAssetIdentifier).filter((value): value is string => !!value)
      : [];

    if (galleryIdentifiers.length && isIOS) {
      const permission = await camera.requestPhotosPermissions();
      if (!permission?.Success) {
        throw new Error('Photos permission is required to delete gallery copies.');
      }
      const assets = PHAsset.fetchAssetsWithLocalIdentifiersOptions(galleryIdentifiers, null as any);
      await new Promise<void>((resolve, reject) => {
        PHPhotoLibrary.sharedPhotoLibrary().performChangesCompletionHandler(
          () => PHAssetChangeRequest.deleteAssets(assets),
          (success, error) => success ? resolve() : reject(error)
        );
      });
    }

    const manifest = this.readPhotoManifest(orderNumber);
    let deleted = 0;
    selected.forEach((photo) => {
      File.fromPath(photo.path).removeSync();
      delete manifest[photo.fileName];
      deleted += 1;
    });
    this.writePhotoManifest(orderNumber, manifest);

    return {
      deleted,
      galleryDeleted: galleryIdentifiers.length,
      unlinkedGalleryCopies: deleteFromPhotos ? selected.length - galleryIdentifiers.length : 0,
    };
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

      const folder = this.orderPhotosFolder(order.number);
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
    order: EzeeOrderListItem,
    initialContentFrame: CGRect = bounds,
    initialCreditFrame: CGRect = initialContentFrame
  ): {
    overlay: UIView;
    coordinateLabel: UILabel;
    updateContentFrame: (contentFrame: CGRect, creditFrame?: CGRect) => void;
  } {
    const overlay = UIView.alloc().initWithFrame(bounds);
    overlay.backgroundColor = UIColor.clearColor;
    overlay.userInteractionEnabled = false;
    overlay.autoresizingMask = UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;

    const logo = UIView.new();
    logo.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0.92);
    logo.layer.masksToBounds = true;
    const ezeeLogo = UIImageView.new();
    ezeeLogo.image = this.iosEzeeLogo();
    ezeeLogo.contentMode = UIViewContentMode.ScaleAspectFit;
    logo.addSubview(ezeeLogo);
    overlay.addSubview(logo);

    const now = new Date();
    const timeParts = this.timeParts(now);
    const time = this.makeOverlayLabel(CGRectZero, timeParts.time, 1);
    overlay.addSubview(time);
    const meridiem = this.makeOverlayLabel(CGRectZero, timeParts.meridiem, 1);
    overlay.addSubview(meridiem);

    const divider = UIView.new();
    divider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(1, 0.71, 0.05, 1);
    overlay.addSubview(divider);
    const date = this.makeOverlayLabel(CGRectZero, this.dateText(now), 1);
    overlay.addSubview(date);
    const weekday = this.makeOverlayLabel(CGRectZero, this.weekdayText(now), 1);
    overlay.addSubview(weekday);
    this.startIosClock(time, meridiem, date, weekday);

    const address = this.makeOverlayLabel(CGRectZero, this.formatAddress(order?.address), 1);
    address.numberOfLines = 2;
    overlay.addSubview(address);
    const coordinates = this.makeOverlayLabel(CGRectZero, 'Coordinate: locating…', 1);
    overlay.addSubview(coordinates);
    const orderLabel = this.makeOverlayLabel(
      CGRectZero,
      `Order #: ${String(order?.number || 'n/a')}`,
      1
    );
    overlay.addSubview(orderLabel);
    const technician = this.makeOverlayLabel(
      CGRectZero,
      `Tech: ${this.getTechnician() || 'unavailable'}`,
      1
    );
    overlay.addSubview(technician);
    const credit = this.makeOverlayLabel(CGRectZero, 'Photo by CCTec', 1);
    credit.textAlignment = NSTextAlignment.Left;
    const appIcon = this.iosAppIcon();
    let iconView: UIImageView | null = null;
    if (appIcon) {
      iconView = UIImageView.new();
      iconView.image = appIcon;
      iconView.contentMode = UIViewContentMode.ScaleAspectFit;
      iconView.layer.masksToBounds = true;
      overlay.addSubview(iconView);
    }
    overlay.addSubview(credit);

    const updateContentFrame = (contentFrame: CGRect, creditFrame: CGRect = contentFrame) => {
      const scale = contentFrame.size.width / 1200;
      const left = contentFrame.origin.x + (34 * scale);
      const contentWidth = contentFrame.size.width - (68 * scale);
      const isFourThreePreview = contentFrame.size.height < bounds.size.height;
      const contentBottom = contentFrame.origin.y + contentFrame.size.height -
        (isFourThreePreview ? 8 : 0);
      const panelTop = contentBottom - (464 * scale);

      logo.frame = CGRectMake(left, panelTop, 250 * scale, 100 * scale);
      logo.layer.cornerRadius = 14 * scale;
      ezeeLogo.frame = CGRectMake(12 * scale, 12 * scale, 226 * scale, 76 * scale);

      const timeY = panelTop + (112 * scale);
      time.frame = CGRectMake(left, timeY, 300 * scale, 126 * scale);
      time.font = UIFont.systemFontOfSizeWeight(112 * scale, UIFontWeightLight);
      meridiem.frame = CGRectMake(
        left + (270 * scale),
        timeY + (7 * scale),
        70 * scale,
        40 * scale
      );
      meridiem.font = UIFont.systemFontOfSize(34 * scale);
      divider.frame = CGRectMake(
        left + (350 * scale),
        timeY + (6 * scale),
        5 * scale,
        102 * scale
      );
      date.frame = CGRectMake(
        left + (375 * scale),
        timeY + (4 * scale),
        450 * scale,
        52 * scale
      );
      date.font = UIFont.systemFontOfSize(43 * scale);
      weekday.frame = CGRectMake(
        left + (375 * scale),
        timeY + (58 * scale),
        220 * scale,
        48 * scale
      );
      weekday.font = UIFont.systemFontOfSize(41 * scale);

      const detailsY = panelTop + (235 * scale);
      address.frame = CGRectMake(left, detailsY, contentWidth, 48 * scale);
      address.font = UIFont.systemFontOfSize(30 * scale);
      coordinates.frame = CGRectMake(left, detailsY + (50 * scale), contentWidth, 40 * scale);
      coordinates.font = UIFont.systemFontOfSize(30 * scale);
      orderLabel.frame = CGRectMake(left, detailsY + (96 * scale), 430 * scale, 38 * scale);
      orderLabel.font = UIFont.systemFontOfSize(31 * scale);
      technician.frame = CGRectMake(left, detailsY + (140 * scale), contentWidth, 40 * scale);
      technician.font = UIFont.systemFontOfSize(32 * scale);

      credit.font = UIFont.systemFontOfSize(28 * scale);
      credit.sizeToFit();
      const creditBottom = creditFrame.origin.y + creditFrame.size.height;
      const isFourThreeCredit = creditFrame.size.height < bounds.size.height;
      const creditRightMargin = isFourThreeCredit ? 50 : 90;
      const creditBottomMargin = isFourThreeCredit ? 24 : 44;
      const creditX = creditFrame.origin.x + creditFrame.size.width -
        (creditRightMargin * scale) - credit.frame.size.width;
      const creditY = creditBottom - (creditBottomMargin * scale) - credit.frame.size.height;
      credit.frame = CGRectMake(
        creditX,
        creditY,
        credit.frame.size.width,
        credit.frame.size.height
      );
      if (iconView) {
        const iconSize = 36 * scale;
        iconView.frame = CGRectMake(
          creditX - iconSize - (5 * scale),
          creditBottom - (creditBottomMargin * scale) - iconSize,
          iconSize,
          iconSize
        );
        iconView.layer.cornerRadius = 5 * scale;
      }
    };
    updateContentFrame(initialContentFrame, initialCreditFrame);
    return { overlay, coordinateLabel: coordinates, updateContentFrame };
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
        let activeDevice = AVCaptureDevice.defaultDeviceWithDeviceTypeMediaTypePosition(
          AVCaptureDeviceTypeBuiltInWideAngleCamera,
          AVMediaTypeVideo,
          AVCaptureDevicePosition.Back
        );
        if (!activeDevice) {
          reject(new Error('Rear camera is not available.'));
          return;
        }
        const inputError = new interop.Reference<NSError>();
        let activeInput = AVCaptureDeviceInput.deviceInputWithDeviceError(activeDevice, inputError);
        if (!activeInput || !session.canAddInput(activeInput)) {
          reject(new Error(inputError.value?.localizedDescription || 'Unable to configure camera input.'));
          return;
        }
        session.addInput(activeInput);

        const photoOutput = AVCapturePhotoOutput.new();
        if (!session.canAddOutput(photoOutput)) {
          reject(new Error('Unable to configure photo capture.'));
          return;
        }
        session.addOutput(photoOutput);
        photoOutput.highResolutionCaptureEnabled = true;
        photoOutput.maxPhotoQualityPrioritization = AVCapturePhotoQualityPrioritization.Speed;
        if (photoOutput.responsiveCaptureSupported) {
          photoOutput.responsiveCaptureEnabled = true;
        }
        if (photoOutput.fastCapturePrioritizationSupported) {
          photoOutput.fastCapturePrioritizationEnabled = true;
        }

        const previewLayer = AVCaptureVideoPreviewLayer.layerWithSession(session);
        let aspectMode = this.savedIosPhotoAspectMode();
        let captureAspectMode = aspectMode;
        let saveToPhotos = this.savedSaveToPhotosPreference();
        let captureSaveToPhotos = saveToPhotos;
        let updateOverlayContentFrame:
          ((contentFrame: CGRect, creditFrame?: CGRect) => void) | undefined;
        const previewFrameForMode = (mode: IosPhotoAspectMode): CGRect => {
          if (mode !== '4:3') {
            return bounds;
          }
          const previewHeight = bounds.size.width * (4 / 3);
          return CGRectMake(
            0,
            (bounds.size.height - previewHeight) / 2,
            bounds.size.width,
            previewHeight
          );
        };
        const applyAspectMode = (mode: IosPhotoAspectMode) => {
          aspectMode = mode;
          ApplicationSettings.setString('ezee-camera-aspect-mode', mode);
          previewLayer.frame = previewFrameForMode(mode);
          previewLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;
          updateOverlayContentFrame?.(
            previewFrameForMode('4:3'),
            mode === 'full' ? bounds : previewFrameForMode('4:3')
          );
        };
        applyAspectMode(aspectMode);
        this.configureIosCaptureConnection(previewLayer.connection);
        this.configureIosCaptureConnection(photoOutput.connectionWithMediaType(AVMediaTypeVideo));
        controller.view.layer.addSublayer(previewLayer);

        const overlayResult = this.buildIosCameraOverlay(
          bounds,
          order,
          previewFrameForMode('4:3'),
          aspectMode === 'full' ? bounds : previewFrameForMode('4:3')
        );
        updateOverlayContentFrame = overlayResult.updateContentFrame;
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
        overlay.multipleTouchEnabled = true;
        controller.view.addSubview(overlay);

        let pinchStartZoom = activeDevice.videoZoomFactor;
        const gestureTarget = {
          nativeViewProtected: overlay,
          isLoaded: true,
          on: () => undefined,
          off: () => undefined,
          notify: () => undefined,
        } as any;
        this.iosPinchZoomObserver = new GesturesObserver(
          gestureTarget,
          (event: PinchGestureEventData) => {
          if (event.state === GestureStateTypes.began) {
            pinchStartZoom = activeDevice.videoZoomFactor;
          }
          if (
            event.state !== GestureStateTypes.began &&
            event.state !== GestureStateTypes.changed
          ) {
            return;
          }
          const maxZoom = Math.min(10, activeDevice.activeFormat.videoMaxZoomFactor);
          const targetZoom = Math.max(1, Math.min(maxZoom, pinchStartZoom * event.scale));
          const zoomError = new interop.Reference<NSError>();
          if (!activeDevice.lockForConfiguration(zoomError)) {
            return;
          }
          activeDevice.videoZoomFactor = targetZoom;
          activeDevice.unlockForConfiguration();
          },
          this
        );
        this.iosPinchZoomObserver.observe(GestureTypes.pinch);

        const formatControl = UISegmentedControl.alloc().initWithItems(['Full', '4:3']);
        formatControl.frame = CGRectMake((bounds.size.width - 150) / 2, 92, 150, 34);
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

        const saveToPhotosLabel = this.makeOverlayLabel(
          CGRectMake((bounds.size.width - 190) / 2, 138, 125, 34),
          'Save to Photos',
          1
        );
        saveToPhotosLabel.font = UIFont.boldSystemFontOfSize(14);
        saveToPhotosLabel.textAlignment = NSTextAlignment.Right;
        overlay.addSubview(saveToPhotosLabel);

        const saveToPhotosSwitch = UISwitch.alloc().initWithFrame(
          CGRectMake((bounds.size.width - 190) / 2 + 137, 139, 52, 32)
        );
        saveToPhotosSwitch.on = saveToPhotos;
        saveToPhotosSwitch.onTintColor = UIColor.colorWithRedGreenBlueAlpha(1, 0.45, 0.12, 1);
        saveToPhotosSwitch.addActionForControlEvents(
          UIAction.actionWithHandler(() => {
            if (!saveToPhotosSwitch.on) {
              saveToPhotos = false;
              ApplicationSettings.setBoolean('ezee-camera-save-to-photos', false);
              return;
            }
            void camera.requestPhotosPermissions().then((permission) => {
              Utils.executeOnMainThread(() => {
                saveToPhotos = !!permission?.Success;
                saveToPhotosSwitch.setOnAnimated(saveToPhotos, true);
                ApplicationSettings.setBoolean('ezee-camera-save-to-photos', saveToPhotos);
              });
            });
          }),
          UIControlEvents.ValueChanged
        );
        overlay.addSubview(saveToPhotosSwitch);

        let photoCount = 0;
        let lastPhotoPath = '';
        let isCapturing = false;
        let isFinished = false;
        let captureStartedAt = 0;
        const finish = () => {
          if (isFinished || isCapturing) {
            return;
          }
          isFinished = true;
          session.stopRunning();
          controller.dismissViewControllerAnimatedCompletion(true, () => {
            this.iosPhotoCaptureDelegate = undefined;
            this.iosPinchZoomObserver?.disconnect();
            this.iosPinchZoomObserver = undefined;
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

        let flashMode = AVCaptureFlashMode.Off;
        const flashButton = UIButton.buttonWithType(UIButtonType.System);
        flashButton.frame = CGRectMake(
          formatControl.frame.origin.x - 44,
          formatControl.frame.origin.y,
          34,
          34
        );
        flashButton.tintColor = UIColor.whiteColor;
        flashButton.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.45);
        flashButton.layer.cornerRadius = 17;
        const updateFlashButton = () => {
          const flashAvailable = activeDevice.hasFlash;
          flashButton.enabled = flashAvailable;
          flashButton.alpha = flashAvailable ? 1 : 0.45;
          const symbolName = !flashAvailable || flashMode === AVCaptureFlashMode.Off
            ? 'bolt.slash.fill'
            : flashMode === AVCaptureFlashMode.Auto
              ? 'bolt.badge.a.fill'
              : 'bolt.fill';
          const image = UIImage.systemImageNamed(symbolName) || UIImage.systemImageNamed('bolt.fill');
          flashButton.setImageForState(image, UIControlState.Normal);
        };
        flashButton.addActionForControlEvents(
          UIAction.actionWithHandler(() => {
            if (!activeDevice.hasFlash || isCapturing) {
              return;
            }
            flashMode = flashMode === AVCaptureFlashMode.Off
              ? AVCaptureFlashMode.On
              : flashMode === AVCaptureFlashMode.On
                ? AVCaptureFlashMode.Auto
                : AVCaptureFlashMode.Off;
            updateFlashButton();
          }),
          UIControlEvents.TouchUpInside
        );
        updateFlashButton();
        overlay.addSubview(flashButton);

        const flipButton = UIButton.buttonWithType(UIButtonType.System);
        flipButton.frame = CGRectMake(
          formatControl.frame.origin.x + formatControl.frame.size.width + 10,
          formatControl.frame.origin.y,
          34,
          34
        );
        flipButton.tintColor = UIColor.whiteColor;
        flipButton.setImageForState(
          UIImage.systemImageNamed('arrow.triangle.2.circlepath.camera.fill') ||
            UIImage.systemImageNamed('arrow.triangle.2.circlepath.camera'),
          UIControlState.Normal
        );
        flipButton.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.45);
        flipButton.layer.cornerRadius = 17;
        flipButton.addActionForControlEvents(
          UIAction.actionWithHandler(() => {
            if (isCapturing || isFinished) {
              return;
            }
            const nextPosition = activeDevice.position === AVCaptureDevicePosition.Back
              ? AVCaptureDevicePosition.Front
              : AVCaptureDevicePosition.Back;
            const nextDevice = AVCaptureDevice.defaultDeviceWithDeviceTypeMediaTypePosition(
              AVCaptureDeviceTypeBuiltInWideAngleCamera,
              AVMediaTypeVideo,
              nextPosition
            );
            if (!nextDevice) {
              return;
            }
            const nextInputError = new interop.Reference<NSError>();
            const nextInput = AVCaptureDeviceInput.deviceInputWithDeviceError(
              nextDevice,
              nextInputError
            );
            if (!nextInput) {
              console.log(
                '[EzeeTimestampCamera] Unable to switch camera',
                nextInputError.value?.localizedDescription || 'input unavailable'
              );
              return;
            }
            session.beginConfiguration();
            session.removeInput(activeInput);
            if (session.canAddInput(nextInput)) {
              session.addInput(nextInput);
              activeInput = nextInput;
              activeDevice = nextDevice;
            } else {
              session.addInput(activeInput);
            }
            session.commitConfiguration();
            this.configureIosCaptureConnection(previewLayer.connection);
            this.configureIosCaptureConnection(
              photoOutput.connectionWithMediaType(AVMediaTypeVideo)
            );
            updateFlashButton();
          }),
          UIControlEvents.TouchUpInside
        );
        overlay.addSubview(flipButton);

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
            captureStartedAt = Date.now();
            captureAspectMode = aspectMode;
            captureSaveToPhotos = saveToPhotos;
            shutter.alpha = 0.45;
            const settings = AVCapturePhotoSettings.photoSettings();
            settings.highResolutionPhotoEnabled = true;
            settings.photoQualityPrioritization = AVCapturePhotoQualityPrioritization.Speed;
            settings.flashMode = activeDevice.hasFlash &&
              activeDevice.isFlashModeSupported(flashMode)
              ? flashMode
              : AVCaptureFlashMode.Off;
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
              console.log(
                '[EzeeTimestampCamera] Capture response time',
                `${Date.now() - captureStartedAt}ms`
              );
              if (!service || !image || error) {
                if (error) {
                  console.log('[EzeeTimestampCamera] Photo capture failed', error);
                }
                isCapturing = false;
                shutter.alpha = 1;
                return;
              }
              void service.saveContinuousIosPhoto(
                new ImageSource(image),
                order,
                captureAspectMode,
                captureSaveToPhotos
              )
                .then((filePath) => {
                  photoCount += 1;
                  lastPhotoPath = filePath;
                  Utils.executeOnMainThread(() => {
                    const thumbnail = ImageSource.fromFileSync(filePath);
                    thumbnailButton.setImageForState(thumbnail?.ios || null, UIControlState.Normal);
                    thumbnailButton.hidden = false;
                  });
                })
                .catch((error) => {
                  console.log('[EzeeTimestampCamera] Unable to save continuous photo', error);
                })
                .finally(() => {
                  console.log(
                    '[EzeeTimestampCamera] Photo ready time',
                    `${Date.now() - captureStartedAt}ms`
                  );
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
        this.iosPinchZoomObserver?.disconnect();
        this.iosPinchZoomObserver = undefined;
        reject(error);
      }
    });
  }

  private async saveContinuousIosPhoto(
    source: ImageSource,
    order: EzeeOrderListItem,
    aspectMode: IosPhotoAspectMode,
    saveToPhotos: boolean
  ): Promise<string> {
    const capturedAt = new Date();
    const cropped = this.prepareIosImageForAspect(source, aspectMode);
    const stamped = this.stampIos(
      cropped,
      order,
      capturedAt,
      this.latestLocation || null,
      aspectMode
    );
    const folder = this.orderPhotosFolder(order.number);
    const fileName = `ezee-${this.safeFilePart(order.number)}-${this.fileTimestamp(capturedAt)}.jpg`;
    const filePath = path.join(folder.path, fileName);
    if (!stamped.saveToFile(filePath, 'jpg', 92)) {
      throw new Error('Unable to save the timestamped photo.');
    }
    if (saveToPhotos) {
      try {
        let galleryAssetIdentifier = '';
        await new Promise<void>((resolve, reject) => {
          PHPhotoLibrary.sharedPhotoLibrary().performChangesCompletionHandler(
            () => {
              const request = PHAssetChangeRequest.creationRequestForAssetFromImage(stamped.ios);
              galleryAssetIdentifier = request.placeholderForCreatedAsset?.localIdentifier || '';
            },
            (success, error) => success ? resolve() : reject(error)
          );
        });
        if (galleryAssetIdentifier) {
          const manifest = this.readPhotoManifest(order.number);
          manifest[fileName] = galleryAssetIdentifier;
          this.writePhotoManifest(order.number, manifest);
        }
      } catch (error) {
        console.log('[EzeeTimestampCamera] Unable to save copy to Photos', error);
        ApplicationSettings.setBoolean('ezee-camera-save-to-photos', false);
      }
    }
    return filePath;
  }

  private orderPhotosFolder(orderNumber: string) {
    return knownFolders.documents()
      .getFolder('ezee-order-photos')
      .getFolder(this.safeFilePart(orderNumber));
  }

  private readPhotoManifest(orderNumber: string): Record<string, string> {
    const manifestFile = this.orderPhotosFolder(orderNumber).getFile('photos.json');
    try {
      const parsed = JSON.parse(manifestFile.readTextSync() || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writePhotoManifest(orderNumber: string, manifest: Record<string, string>): void {
    this.orderPhotosFolder(orderNumber)
      .getFile('photos.json')
      .writeTextSync(JSON.stringify(manifest));
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

  private savedSaveToPhotosPreference(): boolean {
    return ApplicationSettings.getBoolean('ezee-camera-save-to-photos', true);
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
    location: geolocation.Location | null,
    aspectMode?: IosPhotoAspectMode
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
    const isFourThree = aspectMode === '4:3';
    const creditRightMargin = isFourThree ? 50 : 90;
    const creditBottomMargin = isFourThree ? 24 : 44;
    const creditX = width - (creditRightMargin * scale) - creditSize.width;
    const iconSize = 36 * scale;
    const creditBottom = creditBottomMargin * scale;
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
