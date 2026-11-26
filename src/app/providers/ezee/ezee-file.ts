import { Utils, isIOS } from '@nativescript/core';

export function shareEzeeOrderScreenshot(filePath: string): boolean {
  return shareEzeeImage(filePath, 'Share Order Screenshot', 'image/png');
}

export function shareEzeeImages(
  filePaths: string[],
  title = 'Share Order Photos'
): boolean {
  const paths = filePaths.filter((filePath) => !!filePath);
  if (!paths.length) {
    return false;
  }

  if (isIOS) {
    const application = UIApplication.sharedApplication;
    const window = application.keyWindow ||
      (application.windows?.count ? application.windows.objectAtIndex(0) : null);
    const root = window?.rootViewController;
    if (!root) {
      return false;
    }
    const visible = Utils.ios.getVisibleViewController(root);
    const fileUrls = paths.map((filePath) => NSURL.fileURLWithPath(filePath));
    const controller = UIActivityViewController.alloc()
      .initWithActivityItemsApplicationActivities(fileUrls, []);
    const popover = controller.popoverPresentationController;
    if (popover) {
      const { width, height } = visible.view.bounds.size;
      popover.sourceView = visible.view;
      popover.sourceRect = CGRectMake(width / 2, height / 2, 1, 1);
      popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
    }
    visible.presentViewControllerAnimatedCompletion(controller, true, null);
    return true;
  }

  const context = Utils.android.getApplicationContext();
  const uris = new java.util.ArrayList<android.os.Parcelable>();
  paths.forEach((filePath) => {
    uris.add(androidx.core.content.FileProvider.getUriForFile(
      context,
      `${context.getPackageName()}.ezee-screenshots`,
      new java.io.File(filePath),
    ));
  });
  const intent = new android.content.Intent(android.content.Intent.ACTION_SEND_MULTIPLE);
  intent.setType('image/jpeg');
  intent.putParcelableArrayListExtra(android.content.Intent.EXTRA_STREAM, uris);
  intent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
  const chooser = android.content.Intent.createChooser(intent, title);
  chooser.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
  context.startActivity(chooser);
  return true;
}

export function shareEzeeImage(
  filePath: string,
  title = 'Share Order Photo',
  mimeType = 'image/jpeg'
): boolean {
  if (isIOS) {
    return openEzeeFile(filePath, title);
  }

  const context = Utils.android.getApplicationContext();
  const uri = androidx.core.content.FileProvider.getUriForFile(
    context,
    `${context.getPackageName()}.ezee-screenshots`,
    new java.io.File(filePath),
  );
  const intent = new android.content.Intent(android.content.Intent.ACTION_SEND);
  intent.setType(mimeType);
  intent.putExtra(android.content.Intent.EXTRA_STREAM, uri);
  intent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
  const chooser = android.content.Intent.createChooser(intent, title);
  chooser.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
  context.startActivity(chooser);
  return true;
}

export function openEzeeFile(filePath: string, title: string): boolean {
  if (isIOS) {
    const application = UIApplication.sharedApplication;
    const window = application.keyWindow ||
      (application.windows?.count ? application.windows.objectAtIndex(0) : null);
    const root = window?.rootViewController;
    if (root) {
      const visible = Utils.ios.getVisibleViewController(root);
      const fileUrl = NSURL.fileURLWithPath(filePath);
      const controller = UIActivityViewController.alloc()
        .initWithActivityItemsApplicationActivities([fileUrl], []);
      const popover = controller.popoverPresentationController;
      if (popover) {
        const { width, height } = visible.view.bounds.size;
        popover.sourceView = visible.view;
        popover.sourceRect = CGRectMake(width / 2, height / 2, 1, 1);
        popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
      }
      visible.presentViewControllerAnimatedCompletion(controller, true, null);
      return true;
    }
  }

  return Utils.openFile(filePath, title);
}
