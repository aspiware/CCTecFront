import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { Application, Utils } from '@nativescript/core';
import { PhonePipe } from '../shared/pipes/phone.pipe';

@Component({
  standalone: true,
  selector: 'app-customer-info',
  imports: [NativeScriptCommonModule, PhonePipe, TitleCasePipe],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './customer-info.component.html',
  styleUrl: './customer-info.component.scss',
})
export class CustomerInfoComponent {
  job: any;
  private isCopyMenuOpen = false;
  private lastCopyMenuTs = 0;
  mainMenu: Item =
    {
      name: 'Main Menu',
      options: [
        { name: 'Refresh Wi-Fi Info', icon: 'arrow.clockwise' },
        { name: 'Connect to Wi-Fi', icon: 'wifi' },
        { name: 'Share Wi-Fi via SMS', icon: 'ellipsis.message' },
        {
          name: 'Save Wi-Fi Settings', icon: 'checkmark.circle', destructive: true, confirm: {
            title: 'Do you want to save the new Wi-Fi settings?',
            confirmText: 'Yes',
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };

  constructor(private modalParams: ModalDialogParams) {
    this.job = this.modalParams.context;
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    console.log('[CustomerInfo] menu selected', event?.index);
  }

  public closeModal(): void {
    this.modalParams.closeCallback();
  }

  public showMenu(args: any, value: any, copyValue?: any, digitsOnly = false): void {
    if (args && typeof args.cancel === 'boolean') {
      args.cancel = true;
    }

    const now = Date.now();
    if (this.isCopyMenuOpen || now - this.lastCopyMenuTs < 500) {
      return;
    }

    const textToShow = String(value ?? '').trim();
    if (!textToShow || textToShow === '-') {
      return;
    }

    let textToCopy = String(copyValue ?? value ?? '').trim();
    if (digitsOnly) {
      const digits = textToCopy.replace(/\D+/g, '');
      textToCopy = digits || textToCopy;
    }

    if (__IOS__) {
      this.isCopyMenuOpen = true;
      this.lastCopyMenuTs = now;

      let viewController = Application.ios?.rootController;
      while (
        viewController &&
        viewController.presentedViewController &&
        !viewController.presentedViewController.beingDismissed
      ) {
        viewController = viewController.presentedViewController;
      }
      if (!viewController?.view) {
        this.isCopyMenuOpen = false;
        return;
      }

      const sourceView = args?.object?.ios as UIView | undefined;
      const alert = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
        'Copy',
        textToShow,
        UIAlertControllerStyle.ActionSheet
      );

      const copyAction = UIAlertAction.actionWithTitleStyleHandler(
        'Copy',
        UIAlertActionStyle.Default,
        () => {
          UIPasteboard.generalPasteboard.string = textToCopy;
          this.isCopyMenuOpen = false;
        }
      );
      copyAction.setValueForKey(UIImage.systemImageNamed('doc.on.doc'), 'image');
      alert.addAction(copyAction);

      alert.addAction(
        UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, () => {
          this.isCopyMenuOpen = false;
        })
      );

      const popover = alert.popoverPresentationController;
      if (popover) {
        popover.sourceView = sourceView || viewController.view;
        popover.sourceRect = sourceView
          ? sourceView.bounds
          : CGRectMake(
            viewController.view.bounds.size.width / 2,
            viewController.view.bounds.size.height / 2,
            1,
            1
          );
        popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
      }

      viewController.presentViewControllerAnimatedCompletion(alert, true, null);
      return;
    }

    Utils.copyToClipboard(textToCopy);
  }
}
