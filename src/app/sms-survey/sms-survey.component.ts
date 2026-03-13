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
  @ViewChild('spanishSurveyInput', { static: false }) private spanishSurveyInputRef?: ElementRef;
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public englishSurveyText = '';
  public spanishSurveyText = '';
  public settings: any = null;
  public surveyScrollHeight: number | string = 'auto';
  public isSecondSurveyFocused = false;
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
    this.loadSurveyTexts();
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
    this.isSecondSurveyFocused = true;
    this.suppressDismissUntil = Date.now() + 280;
    this.scheduleEnsureSecondSurveyVisible(true);
  }

  public onSurveyBlur(index: number): void {
    this.focusedInputs = Math.max(0, this.focusedInputs - 1);
    if (index === 1) {
      this.isSecondSurveyFocused = false;
    }
    if (this.focusedInputs === 0) {
      this.restoreScrollHeight();
    }
  }

  public onSpanishSurveyTextChange(value: string): void {
    this.spanishSurveyText = value || '';
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    if (event?.index === 0) {
      if (this.isSaveLoading) {
        return;
      }
      this.saveSurveyTexts();
    }
  }

  private loadSurveyTexts(): void {
    const userId = Number(this.usersService.getUser()?.userId || 0);
    if (!userId) {
      this.englishSurveyText = '';
      this.spanishSurveyText = '';
      this.cdr.detectChanges();
      return;
    }

    this.settingsService.findByUser(userId).subscribe({
      next: (res: any) => {
        this.settings = res || null;
        this.englishSurveyText = String(res?.englishSurveyText || '');
        this.spanishSurveyText = String(res?.spanishSurveyText || '');
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
    this.surveyScrollHeight = Math.max(320, screenHeight - 430);
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

  private scheduleEnsureSecondSurveyVisible(animated: boolean): void {
    setTimeout(() => this.ensureSecondSurveyVisible(animated), 0);
    if (animated) {
      setTimeout(() => this.ensureSecondSurveyVisible(true), 90);
    }
  }

  private ensureSecondSurveyVisible(animated: boolean): void {
    const scroll =
      this.surveyScrollRef?.nativeElement ||
      (this.page.getViewById('survey-scroll') as ScrollView | undefined);
    const input = this.spanishSurveyInputRef?.nativeElement as any;
    if (!scroll || !input?.getLocationRelativeTo || !input?.getActualSize) {
      return;
    }

    const relativeLocation = input.getLocationRelativeTo(scroll);
    const inputSize = input.getActualSize();
    const visibleHeight =
      (typeof this.surveyScrollHeight === 'number' ? this.surveyScrollHeight : scroll.getActualSize?.()?.height) || 0;
    const desiredBottomGap = 24;
    const desiredOffset =
      scroll.verticalOffset +
      Number(relativeLocation?.y || 0) +
      Number(inputSize?.height || 0) -
      visibleHeight +
      desiredBottomGap;

    const clampedOffset = Math.max(0, Math.min(scroll.scrollableHeight || 0, desiredOffset));
    if (!animated && clampedOffset <= scroll.verticalOffset + 4) {
      return;
    }
    scroll.scrollToVerticalOffset(clampedOffset, animated);
  }

  private saveSurveyTexts(): void {
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
      englishSurveyText: String(this.englishSurveyText || '').trim(),
      spanishSurveyText: String(this.spanishSurveyText || '').trim(),
    };

    this.isSaveLoading = true;
    this.cdr.detectChanges();

    this.settingsService.updateTexts(settingsPayload).subscribe({
      next: () => {
        this.settings = settingsPayload;
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.showSavedPopupAnchored();
        }, 0);
      },
      error: (error) => {
        console.log('[SmsSurvey] updateTexts error', error);
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
