import { Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { Application, Dialogs, Utils } from '@nativescript/core';
import { PhonePipe } from '../shared/pipes/phone.pipe';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../shared/services/users.service';
import { ConfigService } from '../shared/services/config.service';
import { TodayService } from '../today/today.service';

@Component({
  standalone: true,
  selector: 'app-customer-info',
  imports: [NativeScriptCommonModule, PhonePipe, TitleCasePipe],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './customer-info.component.html',
  styleUrl: './customer-info.component.scss',
})
export class CustomerInfoComponent implements OnInit {
  job: any;
  private userId = 0;
  private settings: any = {};
  private isCopyMenuOpen = false;
  private lastCopyMenuTs = 0;
  private messageComposeDelegate: any;
  public isSharingMobileLink = false;
  mainMenu: Item =
    {
      name: 'Main Menu',
      options: [
        { name: 'Availability SMS', icon: 'message.badge' },
        { name: 'Survey SMS', icon: 'ellipsis.message' },
        { name: 'Share Mobile Link', icon: 'link' },
      ],
    };

  constructor(
    private modalParams: ModalDialogParams,
    private settingsService: SettingsService,
    private usersService: UsersService,
    private configService: ConfigService,
    private todayService: TodayService
  ) {
    this.job = this.modalParams.context;
    console.log('[CustomerInfoComponent]JOB', this.job);
  }

  ngOnInit(): void {
    this.userId = Number(this.usersService.getUser()?.userId || 0);
    if (!this.userId) {
      return;
    }

    this.settingsService.findByUser(this.userId).subscribe({
      next: (res) => {
        this.settings = res || {};
      },
      error: () => {},
    });
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    switch (event?.index) {
      case 0:
        const availabilityRecipients = this.getUniqueCustomerPhoneDigits();
        if (!availabilityRecipients.length) {
          return;
        }
        this.showAvailabilityLanguageMenu((event as any)?.object?.ios as UIView | undefined, availabilityRecipients);
        break;
      case 1:
        const surveyRecipients = this.getUniqueCustomerPhoneDigits();
        if (!surveyRecipients.length) {
          return;
        }
        this.showSurveyLanguageMenu((event as any)?.object?.ios as UIView | undefined, surveyRecipients);
        break;
      case 2:
        this.shareMobileLink();
        break;
      default:
        break;
    }
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
    allowMessage = false,
    title = 'Copy'
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
        title || 'Copy',
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
            this.showAvailabilityLanguageMenu(sourceView, phoneDigits);
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

  private showAvailabilityLanguageMenu(
    sourceView: UIView | undefined,
    recipients: string | string[]
  ): void {
    const recipientsList = Array.isArray(recipients) ? recipients : [recipients];
    if (!__IOS__ || !recipientsList.length) {
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
      'Send Availability SMS',
      'Choose language',
      UIAlertControllerStyle.ActionSheet
    );

    const englishAction = UIAlertAction.actionWithTitleStyleHandler(
      'English',
      UIAlertActionStyle.Default,
      () => {
        this.openSmsComposer(
          recipientsList,
          this.settings?.englishAvailabilityText || 'Hi, this is Xfinity tech, are you available for your appointment?'
        );
        this.isCopyMenuOpen = false;
      }
    );
    englishAction.setValueForKey(UIImage.systemImageNamed('message'), 'image');
    alert.addAction(englishAction);

    const spanishAction = UIAlertAction.actionWithTitleStyleHandler(
      'Spanish',
      UIAlertActionStyle.Default,
      () => {
        this.openSmsComposer(
          recipientsList,
          this.settings?.spanishAvailabilityText || 'Hola, soy el tecnico de Xfinity, esta disponible para su cita?'
        );
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

  private showSurveyLanguageMenu(
    sourceView: UIView | undefined,
    recipients: string | string[]
  ): void {
    const recipientsList = Array.isArray(recipients) ? recipients : [recipients];
    if (!__IOS__ || !recipientsList.length) {
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
      'Send Survey SMS',
      'Choose language',
      UIAlertControllerStyle.ActionSheet
    );

    const englishAction = UIAlertAction.actionWithTitleStyleHandler(
      'English Survey',
      UIAlertActionStyle.Default,
      () => {
        this.openSmsComposer(
          recipientsList,
          this.settings?.englishSurveyText || 'English Survey',
          true
        );
        this.isCopyMenuOpen = false;
      }
    );
    englishAction.setValueForKey(UIImage.systemImageNamed('message'), 'image');
    alert.addAction(englishAction);

    const spanishAction = UIAlertAction.actionWithTitleStyleHandler(
      'Spanish Survey',
      UIAlertActionStyle.Default,
      () => {
        this.openSmsComposer(
          recipientsList,
          this.settings?.spanishSurveyText || 'Spanish Survey',
          true
        );
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

  private openSmsComposer(recipients: string | string[], messageBody: string, marksSurveySent = false): void {
    const recipientsList = Array.isArray(recipients) ? recipients : [recipients];
    const numbers = recipientsList
      .map((n) => String(n ?? '').replace(/\D+/g, ''))
      .filter((n) => !!n);
    if (!numbers.length) {
      return;
    }

    if (__IOS__) {
      if (typeof MFMessageComposeViewController === 'undefined' || !MFMessageComposeViewController.canSendText()) {
        return;
      }

      this.presentInAppSmsComposer(numbers, messageBody, marksSurveySent);
      return;
    }

    const separator = __ANDROID__ ? ';' : ',';
    const joinedRecipients = numbers.join(separator);
    const safeNumber = encodeURIComponent(joinedRecipients);
    const safeBody = encodeURIComponent(messageBody);
    const primary = `sms:${safeNumber}&body=${safeBody}`;
    const secondary = `sms:${safeNumber}?body=${safeBody}`;
    const opened = Utils.openUrl(primary);
    if (!opened) {
      Utils.openUrl(secondary);
    }
  }

  private presentInAppSmsComposer(recipients: string[], body: string, marksSurveySent = false): void {
    const controller = MFMessageComposeViewController.new();
    const MessageComposeDelegate = (NSObject as any).extend(
      {
        messageComposeViewControllerDidFinishWithResult: (
          msgController: MFMessageComposeViewController,
          msgResult: MessageComposeResult
        ) => {
          if (marksSurveySent && Number(msgResult) === Number(MessageComposeResult.Sent)) {
            this.markSurveySent();
          }
          msgController.dismissViewControllerAnimatedCompletion(true, null);
          this.messageComposeDelegate = null;
        },
      },
      {
        protocols: [MFMessageComposeViewControllerDelegate],
      }
    );

    this.messageComposeDelegate = MessageComposeDelegate.new();
    controller.body = String(body || '');
    controller.recipients = recipients as any;
    controller.messageComposeDelegate = this.messageComposeDelegate;
    (controller as any).__delegate = this.messageComposeDelegate;

    let presenter = Application.ios?.rootController as UIViewController;
    while (presenter?.presentedViewController) {
      presenter = presenter.presentedViewController;
    }
    presenter?.presentViewControllerAnimatedCompletion(controller, true, null);
  }

  private markSurveySent(): void {
    const jobNumber = String(this.job?.number || '').trim();
    if (!jobNumber) {
      return;
    }
    this.configService.setSurveySent(jobNumber);
    this.configService.sendData({ type: 'surveySent', jobNumber });
    this.job.sms_survey_sent = true;
  }

  private getUniqueCustomerPhoneDigits(): string[] {
    const customer = this.job?.customer || {};
    const rawPhones = [
      customer.homePhoneNumber,
      customer.callFirstPhoneNumber,
      customer.workPhoneNumber,
      customer.surveyPhoneNumber,
    ];

    const unique = new Set<string>();
    for (const raw of rawPhones) {
      const digits = String(raw ?? '').replace(/\D+/g, '');
      if (!digits) {
        continue;
      }
      unique.add(digits);
    }
    return Array.from(unique);
  }

  private getCustomerEmailList(): string[] {
    const email = String(this.job?.customer?.email || '').trim().toLowerCase();
    return email ? [email] : [];
  }

  private shareMobileLink(): void {
    if (this.isSharingMobileLink) {
      return;
    }

    const accountNumber = String(this.job?.accountNumber || '').trim();
    const workOrderNumber = String(this.job?.workOrderNumber || '').trim();
    const emails = this.getCustomerEmailList();
    const phoneNumbers = this.getUniqueCustomerPhoneDigits();

    if (!this.userId || !accountNumber || !workOrderNumber) {
      Dialogs.alert({
        title: 'Share Mobile Link',
        message: 'Missing data to share the mobile link.',
        okButtonText: 'OK',
      });
      return;
    }

    if (!emails.length && !phoneNumbers.length) {
      Dialogs.alert({
        title: 'Share Mobile Link',
        message: 'No email or phone number is available for this customer.',
        okButtonText: 'OK',
      });
      return;
    }

    this.isSharingMobileLink = true;

    this.todayService.shareMobileLink(this.userId, accountNumber, workOrderNumber, emails, phoneNumbers).subscribe({
      next: () => {
        Dialogs.alert({
          title: 'Share Mobile Link',
          message: 'Mobile link shared successfully.',
          okButtonText: 'OK',
        });
      },
      error: (error) => {
        this.isSharingMobileLink = false;
        Dialogs.alert({
          title: 'Share Mobile Link',
          message: String(error?.error?.message || error?.message || 'Failed to share mobile link.'),
          okButtonText: 'OK',
        });
      },
      complete: () => {
        this.isSharingMobileLink = false;
      },
    });
  }
}
