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

  public showMenu(
    args: any,
    value: any,
    copyValue?: any,
    digitsOnly = false,
    allowCall = false,
    allowMessage = false
  ): void {
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

    if (!textToCopy || textToCopy === '-') {
      return;
    }

    const phoneDigits = String(copyValue ?? value ?? '').replace(/\D+/g, '');

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

      if (allowCall && phoneDigits) {
        const callAction = UIAlertAction.actionWithTitleStyleHandler(
          'Call',
          UIAlertActionStyle.Default,
          () => {
            Utils.openUrl(`tel://${phoneDigits}`);
            this.isCopyMenuOpen = false;
          }
        );
        callAction.setValueForKey(UIImage.systemImageNamed('phone.fill'), 'image');
        alert.addAction(callAction);
      }

      if (allowMessage && phoneDigits) {
        const availabilityAction = UIAlertAction.actionWithTitleStyleHandler(
          'Availability',
          UIAlertActionStyle.Default,
          () => {
            this.openSmsComposer(phoneDigits, 'Hi, are you available for your appointment?');
            this.isCopyMenuOpen = false;
          }
        );
        availabilityAction.setValueForKey(UIImage.systemImageNamed('message.badge'), 'image');
        alert.addAction(availabilityAction);

        const messageAction = UIAlertAction.actionWithTitleStyleHandler(
          'Send Survey',
          UIAlertActionStyle.Default,
          () => {
            this.isCopyMenuOpen = false;
            this.showSurveyLanguageMenu(sourceView, phoneDigits);
          }
        );
        messageAction.setValueForKey(UIImage.systemImageNamed('ellipsis.message'), 'image');
        alert.addAction(messageAction);
      }

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

  private showSurveyLanguageMenu(sourceView: UIView | undefined, phoneDigits: string): void {
    if (!__IOS__ || !phoneDigits) {
      return;
    }

    this.isCopyMenuOpen = true;
    this.lastCopyMenuTs = Date.now();

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

    const alert = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      'Send Message',
      'Choose survey language',
      UIAlertControllerStyle.ActionSheet
    );

    const englishAction = UIAlertAction.actionWithTitleStyleHandler(
      'English Survey',
      UIAlertActionStyle.Default,
      () => {
        this.openSmsComposer(phoneDigits, 'English Survey');
        this.isCopyMenuOpen = false;
      }
    );
    englishAction.setValueForKey(UIImage.systemImageNamed('message'), 'image');
    alert.addAction(englishAction);

    const spanishAction = UIAlertAction.actionWithTitleStyleHandler(
      'Spanish Survey',
      UIAlertActionStyle.Default,
      () => {
        this.openSmsComposer(phoneDigits, 'Spanish Survey');
        this.isCopyMenuOpen = false;
      }
    );
    spanishAction.setValueForKey(UIImage.systemImageNamed('message'), 'image');
    alert.addAction(spanishAction);

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
  }

  private openSmsComposer(phoneDigits: string, messageBody: string): void {
    const safeNumber = encodeURIComponent(phoneDigits);
    const safeBody = encodeURIComponent(messageBody);
    const primary = `sms:${safeNumber}&body=${safeBody}`;
    const secondary = `sms:${safeNumber}?body=${safeBody}`;
    const opened = Utils.openUrl(primary);
    if (!opened) {
      Utils.openUrl(secondary);
    }
  }
}
