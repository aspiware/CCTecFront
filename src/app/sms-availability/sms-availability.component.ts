import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Page, Screen, ScrollView, Utils, alert, isAndroid, isIOS } from '@nativescript/core';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../shared/services/users.service';

@Component({
  standalone: true,
  selector: 'app-sms-availability',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './sms-availability.component.html',
  styleUrl: './sms-availability.component.scss',
})
export class SmsAvailabilityComponent implements OnInit, OnDestroy {
  @ViewChild('availabilityScroll', { static: false }) private availabilityScrollRef?: ElementRef<ScrollView>;
  @ViewChild('spanishAvailabilityInput', { static: false }) private spanishAvailabilityInputRef?: ElementRef;
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public englishAvailabilityText = '';
  public spanishAvailabilityText = '';
  public settings: any = null;
  public availabilityScrollHeight: number | string = 'auto';
  public isSecondAvailabilityFocused = false;
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
    this.loadAvailabilityTexts();
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

  public onAvailabilityFocus(index: number): void {
    this.onInputTap();
    this.focusedInputs += 1;
    this.reduceScrollHeightForKeyboard();
    if (index !== 1) {
      return;
    }
    this.isSecondAvailabilityFocused = true;
    this.suppressDismissUntil = Date.now() + 280;
    this.scheduleEnsureSecondAvailabilityVisible(true);
  }

  public onAvailabilityBlur(index: number): void {
    this.focusedInputs = Math.max(0, this.focusedInputs - 1);
    if (index === 1) {
      this.isSecondAvailabilityFocused = false;
    }
    if (this.focusedInputs === 0) {
      this.restoreScrollHeight();
    }
  }

  public onSpanishAvailabilityTextChange(value: string): void {
    this.spanishAvailabilityText = value || '';
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    if (event?.index === 0) {
      if (this.isSaveLoading) {
        return;
      }
      this.saveAvailabilityTexts();
    }
  }

  private loadAvailabilityTexts(): void {
    const userId = Number(this.usersService.getUser()?.userId || 0);
    if (!userId) {
      this.englishAvailabilityText = '';
      this.spanishAvailabilityText = '';
      this.cdr.detectChanges();
      return;
    }

    this.settingsService.findByUser(userId).subscribe({
      next: (res: any) => {
        this.settings = res || null;
        this.englishAvailabilityText = String(res?.englishAvailabilityText || '');
        this.spanishAvailabilityText = String(res?.spanishAvailabilityText || '');
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[SmsAvailability] findByUser error', error);
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
    this.availabilityScrollHeight = Math.max(320, screenHeight - 430);
    this.cdr.detectChanges();
  }

  private restoreScrollHeight(): void {
    this.availabilityScrollHeight = 'auto';
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

  private scheduleEnsureSecondAvailabilityVisible(animated: boolean): void {
    setTimeout(() => this.ensureSecondAvailabilityVisible(animated), 0);
    if (animated) {
      setTimeout(() => this.ensureSecondAvailabilityVisible(true), 90);
    }
  }

  private ensureSecondAvailabilityVisible(animated: boolean): void {
    const scroll =
      this.availabilityScrollRef?.nativeElement ||
      (this.page.getViewById('availability-scroll') as ScrollView | undefined);
    const input = this.spanishAvailabilityInputRef?.nativeElement as any;
    if (!scroll || !input?.getLocationRelativeTo || !input?.getActualSize) {
      return;
    }

    const relativeLocation = input.getLocationRelativeTo(scroll);
    const inputSize = input.getActualSize();
    const visibleHeight =
      (typeof this.availabilityScrollHeight === 'number'
        ? this.availabilityScrollHeight
        : scroll.getActualSize?.()?.height) || 0;
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

  private saveAvailabilityTexts(): void {
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
      englishAvailabilityText: String(this.englishAvailabilityText || ''),
      spanishAvailabilityText: String(this.spanishAvailabilityText || ''),
    };

    this.isSaveLoading = true;
    this.cdr.detectChanges();

    this.settingsService.update(this.settings.id, settingsPayload).subscribe({
      next: () => {
        this.settings = {
          ...this.settings,
          ...settingsPayload,
        };
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.showSavedPopupAnchored();
        }, 0);
      },
      error: (error) => {
        console.log('[SmsAvailability] update error', error);
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        alert({
          title: 'Error',
          message: 'Unable to save availability texts.',
          okButtonText: 'OK',
        });
      },
    });
  }

  private async showSavedPopupAnchored(): Promise<void> {
    if (!isIOS) {
      await alert({
        title: 'Saved',
        message: 'Availability texts updated successfully.',
        okButtonText: 'OK',
      });
      return;
    }

    try {
      const anchorView = this.page.getViewById('sms-availability-menu-btn') as any;
      const iosAnchor = anchorView?.ios as UIButton | undefined;
      const popup = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
        'Saved',
        'Availability texts updated successfully.',
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
          message: 'Availability texts updated successfully.',
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
      console.log('[SmsAvailability] showSavedPopupAnchored error', error);
      await alert({
        title: 'Saved',
        message: 'Availability texts updated successfully.',
        okButtonText: 'OK',
      });
    }
  }
}
