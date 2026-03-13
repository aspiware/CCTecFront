import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Page, Screen, ScrollView, Utils, alert, isAndroid, isIOS } from '@nativescript/core';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../shared/services/users.service';

@Component({
  standalone: true,
  selector: 'app-sms-survey',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './sms-survey.component.html',
  styleUrl: './sms-survey.component.scss',
})
export class SmsSurveyComponent implements OnInit, OnDestroy {
  @ViewChild('surveyScroll', { static: false }) private surveyScrollRef?: ElementRef<ScrollView>;
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public token = '';
  public settings: any = null;
  public surveyScrollHeight: number | string = 'auto';
  private focusedInputs = 0;
  private suppressDismissUntil = 0;
  private dismissKeyboardTimer?: ReturnType<typeof setTimeout>;
  private appearanceChangedHandler?: () => void;
  public mainMenuR: Item = {
    name: 'Main Menu Right',
    options: [
      {
        name: 'Save',
        icon: 'checkmark.circle',
        destructive: true,
        confirm: {
          title: 'Are you sure you want to save changes?',
          confirmText: 'Yes',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      },
      { name: 'Paste Token', icon: 'doc.on.clipboard' },
    ],
  };

  constructor(
    private usersService: UsersService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    private page: Page
  ) {}

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    this.loadXmToken();
  }

  ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
      this.dismissKeyboardTimer = undefined;
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onContainerTap(event: any): void {
    if (Date.now() < this.suppressDismissUntil) {
      return;
    }
    if (this.isTextInputTap(event)) {
      return;
    }
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
    }
    this.dismissKeyboardTimer = setTimeout(() => {
      Utils.dismissKeyboard();
      this.dismissKeyboardTimer = undefined;
    }, 120);
  }

  public onInputTap(): void {
    this.suppressDismissUntil = Date.now() + 350;
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
      this.dismissKeyboardTimer = undefined;
    }
  }

  public onSurveyFocus(index: number): void {
    this.onInputTap();
    this.focusedInputs += 1;
    this.reduceScrollHeightForKeyboard();
    if (index !== 1) {
      return;
    }
    this.suppressDismissUntil = Date.now() + 280;
    setTimeout(() => {
      const scroll =
        this.surveyScrollRef?.nativeElement ||
        (this.page.getViewById('survey-scroll') as ScrollView | undefined);
      if (!scroll) {
        return;
      }
      const targetOffset = 300;
      scroll.scrollToVerticalOffset(targetOffset, true);
      setTimeout(() => {
        scroll.scrollToVerticalOffset(targetOffset + 100, true);
      }, 120);
    }, 90);
  }

  public onSurveyBlur(): void {
    this.focusedInputs = Math.max(0, this.focusedInputs - 1);
    if (this.focusedInputs === 0) {
      this.restoreScrollHeight();
    }
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    if (event?.index === 0) {
      if (this.isSaveLoading) {
        return;
      }
      this.saveXmToken();
      return;
    }
    if (event?.index === 1) {
      this.pasteTokenFromClipboard();
    }
  }

  private loadXmToken(): void {
    const userId = Number(this.usersService.getUser()?.userId || 0);
    if (!userId) {
      this.token = '';
      this.cdr.detectChanges();
      return;
    }

    this.settingsService.findByUser(userId).subscribe({
      next: (res: any) => {
        this.settings = res || null;
        this.token = String(res?.xmToken || '');
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[SmsSurvey] findByUser error', error);
      },
    });
  }

  private syncTheme(): void {
    const appAppearance = Application.systemAppearance();
    if (appAppearance === 'dark' || appAppearance === 'light') {
      this.isDarkTheme = appAppearance === 'dark';
      return;
    }

    const pageClassName = String(this.page.className || '');
    this.isDarkTheme = pageClassName.includes('ns-dark');
  }

  private reduceScrollHeightForKeyboard(): void {
    const screenHeight = Screen.mainScreen.heightDIPs || 700;
    this.surveyScrollHeight = Math.max(210, screenHeight - 500);
    this.cdr.detectChanges();
  }

  private restoreScrollHeight(): void {
    this.surveyScrollHeight = 'auto';
    this.cdr.detectChanges();
  }

  private isTextInputTap(event: any): boolean {
    if (isIOS) {
      const iosView = event?.ios?.view;
      const className = String(iosView?.className || '');
      return className.includes('UITextField') || className.includes('UITextView');
    }

    if (isAndroid) {
      const androidView = event?.android?.view;
      const className = String(androidView?.getClass?.()?.getName?.() || '');
      return className.includes('EditText');
    }

    return false;
  }

  private saveXmToken(): void {
    Utils.dismissKeyboard();

    if (!this.settings?.id) {
      alert({
        title: 'Error',
        message: 'Settings not loaded yet.',
        okButtonText: 'OK',
      });
      return;
    }

    const settingsPayload = {
      ...this.settings,
      xmToken: String(this.token || '').trim(),
    };

    this.isSaveLoading = true;
    this.cdr.detectChanges();

    this.settingsService.update(this.settings.id, settingsPayload).subscribe({
      next: () => {
        this.settings = settingsPayload;
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.showSavedPopupAnchored();
        }, 0);
      },
      error: (error) => {
        console.log('[SmsSurvey] update error', error);
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        alert({
          title: 'Error',
          message: 'Unable to save survey.',
          okButtonText: 'OK',
        });
      },
    });
  }

  private pasteTokenFromClipboard(): void {
    try {
      const clipboardText = this.readClipboardText();
      const raw = String(clipboardText ?? '');
      this.token = raw.replace(/^Bearer(?:\+|\s)+/i, '');
      this.cdr.detectChanges();
    } catch (error) {
      console.log('[SmsSurvey] Clipboard paste error:', error);
    }
  }

  private readClipboardText(): string {
    if (isIOS) {
      return String(UIPasteboard.generalPasteboard.string || '');
    }

    if (isAndroid) {
      const context = Application.android.context;
      const clipboard = context?.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager;
      if (!clipboard?.hasPrimaryClip()) {
        return '';
      }

      const clip = clipboard.getPrimaryClip();
      if (!clip || clip.getItemCount() < 1) {
        return '';
      }

      return String(clip.getItemAt(0).coerceToText(context) || '');
    }

    return '';
  }

  private async showSavedPopupAnchored(): Promise<void> {
    if (!isIOS) {
      await alert({
        title: 'Saved',
        message: 'Survey updated successfully.',
        okButtonText: 'OK',
      });
      return;
    }

    try {
      const anchorView = this.page.getViewById('sms-survey-menu-btn') as any;
      const iosAnchor = anchorView?.ios as UIButton | undefined;
      const popup = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
        'Saved',
        'Survey updated successfully.',
        UIAlertControllerStyle.ActionSheet
      );
      popup.addAction(
        UIAlertAction.actionWithTitleStyleHandler('OK', UIAlertActionStyle.Default, null)
      );

      let viewController = Application.ios?.rootController;
      while (
        viewController &&
        viewController.presentedViewController &&
        !viewController.presentedViewController.beingDismissed
      ) {
        viewController = viewController.presentedViewController;
      }

      if (!viewController) {
        await alert({
          title: 'Saved',
          message: 'Survey updated successfully.',
          okButtonText: 'OK',
        });
        return;
      }

      const popover = popup.popoverPresentationController;
      if (popover) {
        if (iosAnchor) {
          popover.sourceView = iosAnchor;
          popover.sourceRect = iosAnchor.bounds;
        } else {
          popover.sourceView = viewController.view;
          popover.sourceRect = CGRectMake(
            viewController.view.bounds.size.width / 2.0,
            viewController.view.bounds.size.height / 2.0,
            1.0,
            1.0
          );
        }
        popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
      }

      viewController.presentViewControllerAnimatedCompletion(popup, true, null);
    } catch (error) {
      console.log('[SmsSurvey] showSavedPopupAnchored error', error);
      await alert({
        title: 'Saved',
        message: 'Survey updated successfully.',
        okButtonText: 'OK',
      });
    }
  }
}
