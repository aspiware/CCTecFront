import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, isAndroid, isIOS, Page, Screen, ScrollView, Utils, alert } from '@nativescript/core';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { SettingsService } from '../settings/settings.service';
import { UserModel } from '../shared/models/user.model';
import { UsersService } from '../shared/services/users.service';
import { QuantityStepperComponent } from '../shared/components/quantity-stepper/quantity-stepper.component';

@Component({
  standalone: true,
  selector: 'app-payroll',
  imports: [NativeScriptCommonModule, QuantityStepperComponent],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './payroll.component.html',
  styleUrl: './payroll.component.scss',
})
export class PayrollComponent implements OnInit, OnDestroy {
  @ViewChild('pricesScroll', { static: false }) private pricesScrollRef?: ElementRef<ScrollView>;
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public user: UserModel | null = null;
  public settings: any = null;
  public meterRentAmount = 0;
  public meterRentAmountText = '0.00';
  public billingPlatformAmount = 0;
  public billingPlatformAmountText = '0.00';
  public fundWeeks = 0;
  public payDay = 0;
  public weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  public pricesScrollHeight: number | string = 'auto';
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
      { name: 'Refresh', icon: 'arrow.clockwise' },
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

    this.user = this.usersService.getUser() || null;
    this.loadSettingsPrices();
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

  public onSelectedMainMenuR(event: MenuEvent): void {
    switch (event?.index) {
      case 0:
        this.saveChanges();
        break;
      case 1:
        this.refreshData();
        break;
      default:
        break;
    }
  }

  private saveChanges(): void {
    if (this.isSaveLoading) {
      return;
    }
    this.endEditingBeforeRefresh();

    const userId = Number(this.user?.userId || 0);
    if (!userId) {
      alert({
        title: 'Error',
        message: 'User not found. Please log in again.',
        okButtonText: 'OK',
      });
      return;
    }

    if (!this.settings?.id) {
      alert({
        title: 'Error',
        message: 'Settings not loaded yet.',
        okButtonText: 'OK',
      });
      return;
    }

    this.isSaveLoading = true;
    this.cdr.detectChanges();

    const settingsPayload = {
      meterRentAmount: Number(this.meterRentAmount || 0),
      billingPlatformAmount: Number(this.billingPlatformAmount || 0),
      fundWeeks: Number(this.fundWeeks || 0),
      payday: Number(this.payDay || 0),
    };

    this.settingsService.update(this.settings.id, settingsPayload).subscribe({
      next: async () => {
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
      error: async (error) => {
        console.log('[Payroll] saveChanges error', error);
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        await alert({
          title: 'Error',
          message: 'Unable to save prices. Please try again.',
          okButtonText: 'OK',
        });
      },
    });
  }

  private refreshData(): void {
    this.endEditingBeforeRefresh();
    this.loadSettingsPrices();
  }

  private loadSettingsPrices(): void {
    const userId = Number(this.user?.userId || 0);
    if (!userId) {
      this.settings = null;
      this.meterRentAmount = 0;
      this.meterRentAmountText = '0.00';
      this.billingPlatformAmount = 0;
      this.billingPlatformAmountText = '0.00';
      this.fundWeeks = 0;
      this.payDay = 0;
      this.cdr.detectChanges();
      return;
    }

    this.settingsService.findByUser(userId).subscribe({
      next: (res: any) => {
        this.settings = res || null;
        this.meterRentAmount = Number(res?.meterRentAmount || 0);
        this.meterRentAmountText = this.formatPriceInput(this.meterRentAmount);
        this.billingPlatformAmount = Number(res?.billingPlatformAmount || 0);
        this.billingPlatformAmountText = this.formatPriceInput(this.billingPlatformAmount);
        this.fundWeeks = Number(res?.fundWeeks || 0);
        this.payDay = Math.max(0, Math.min(6, Number(res?.payday || 0)));
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[Payroll] findByUser error', error);
      },
    });
  }

  public onAmountChange(type: 'meterRent' | 'billingPlatform', event: any): void {
    const rawValue = String(event?.value ?? '');
    const sanitized = this.sanitizePriceInput(rawValue);
    if (event?.object && event.object.text !== sanitized) {
      event.object.text = sanitized;
    }

    const parsed = Number(sanitized);
    const nextValue = Number.isFinite(parsed) ? parsed : 0;

    if (type === 'meterRent') {
      this.meterRentAmountText = sanitized;
      this.meterRentAmount = nextValue;
      return;
    }

    this.billingPlatformAmountText = sanitized;
    this.billingPlatformAmount = nextValue;
  }

  public onFundWeeksChanged(value: number): void {
    this.fundWeeks = Number(value || 0);
  }

  public onPayDayChanged(event: any): void {
    const index = Number(event?.value ?? event);
    this.payDay = Number.isNaN(index) ? 0 : Math.max(0, Math.min(6, index));
  }

  public onAmountBlur(type: 'meterRent' | 'billingPlatform'): void {
    if (type === 'meterRent') {
      this.meterRentAmountText = this.formatPriceInput(this.meterRentAmount);
    } else {
      this.billingPlatformAmountText = this.formatPriceInput(this.billingPlatformAmount);
    }

    this.focusedInputs = Math.max(0, this.focusedInputs - 1);
    if (this.focusedInputs === 0) {
      this.restoreScrollHeight();
    }
  }

  public onPriceFocus(index: number): void {
    this.onInputTap();
    this.focusedInputs += 1;
    this.reduceScrollHeightForKeyboard();
    this.suppressDismissUntil = Date.now() + 280;
    setTimeout(() => {
      const scroll =
        this.pricesScrollRef?.nativeElement ||
        (this.page.getViewById('prices-scroll') as ScrollView | undefined);
      if (!scroll) {
        return;
      }
      const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
      const targetOffset = Math.max(0, (safeIndex * 80) - 110);
      scroll.scrollToVerticalOffset(targetOffset, true);
      if (safeIndex > 2 && targetOffset > 0) {
        setTimeout(() => {
          scroll.scrollToVerticalOffset(targetOffset + 60, true);
        }, 120);
      }
    }, 90);
  }

  private formatPriceInput(value: any): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '0.00';
    }
    return numeric.toFixed(2);
  }

  private sanitizePriceInput(value: string): string {
    const clean = value.replace(/[^0-9.]/g, '');
    const firstDot = clean.indexOf('.');
    if (firstDot < 0) {
      return clean;
    }
    const beforeDot = clean.slice(0, firstDot + 1);
    const afterDot = clean.slice(firstDot + 1).replace(/\./g, '');
    return `${beforeDot}${afterDot}`;
  }

  private endEditingBeforeRefresh(): void {
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
      this.dismissKeyboardTimer = undefined;
    }
    this.focusedInputs = 0;
    this.restoreScrollHeight();
    Utils.dismissKeyboard();
  }

  private async showSavedPopupAnchored(): Promise<void> {
    if (!isIOS) {
      await alert({
        title: 'Saved',
        message: 'Prices were saved successfully.',
        okButtonText: 'OK',
      });
      return;
    }

    try {
      const anchorView = this.page.getViewById('payroll-main-menu-btn') as any;
      const iosAnchor = anchorView?.ios as UIButton | undefined;

      const popup = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
        'Saved',
        'Prices were saved successfully.',
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
          message: 'Prices were saved successfully.',
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
      console.log('[Payroll] showSavedPopupAnchored error', error);
      await alert({
        title: 'Saved',
        message: 'Prices were saved successfully.',
        okButtonText: 'OK',
      });
    }
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
    this.pricesScrollHeight = Math.max(200, screenHeight - 430);
    this.cdr.detectChanges();
  }

  private restoreScrollHeight(): void {
    this.pricesScrollHeight = 'auto';
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
}
