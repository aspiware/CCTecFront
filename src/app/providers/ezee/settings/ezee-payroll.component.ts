import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Page, ScrollView, Utils, alert } from '@nativescript/core';
import { QuantityStepperComponent } from '../../../shared/components/quantity-stepper/quantity-stepper.component';
import { MenuEvent } from '../../../shared/components/menu-button/common';
import { Item } from '../../../shared/components/menu-button/item';
import { EzeePayrollService } from './ezee-payroll.service';

type PayrollAmountType = 'carRental' | 'toolRental' | 'meterRent' | 'billingPlatform';

@Component({
  standalone: true,
  selector: 'app-ezee-payroll',
  imports: [NativeScriptCommonModule, QuantityStepperComponent],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: '../../../payroll/payroll.component.html',
  styleUrl: '../../../payroll/payroll.component.scss',
})
export class EzeePayrollComponent implements OnInit, OnDestroy {
  public showMeterRentAmount = false;
  public showBillingPlatformAmount = false;
  @ViewChild('pricesScroll', { static: false }) private pricesScrollRef?: ElementRef<ScrollView>;
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public carRentalAmount = 0;
  public carRentalAmountText = '0.00';
  public toolRentalAmount = 0;
  public toolRentalAmountText = '0.00';
  public meterRentAmount = 0;
  public meterRentAmountText = '0.00';
  public billingPlatformAmount = 0;
  public billingPlatformAmountText = '0.00';
  public fundWeeks = 0;
  public payDay = -1;
  public weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  public pricesScrollHeight: number | string = 'auto';
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
  private focusedInputs = 0;
  private suppressDismissUntil = 0;
  private dismissKeyboardTimer?: ReturnType<typeof setTimeout>;
  private appearanceChangedHandler?: () => void;

  public constructor(
    private cdr: ChangeDetectorRef,
    private page: Page,
    private payrollService: EzeePayrollService
  ) {}

  public ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    this.loadPayrollSettings();
  }

  public ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    if (event?.index === 0) {
      this.savePayrollSettings();
      return;
    }
    if (event?.index === 1) {
      this.loadPayrollSettings();
    }
  }

  public onContainerTap(event: any): void {
    if (Date.now() < this.suppressDismissUntil || this.isTextInputTap(event)) {
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

  public onAmountChange(type: PayrollAmountType, event: any): void {
    const sanitized = this.sanitizePriceInput(String(event?.value ?? ''));
    if (event?.object && event.object.text !== sanitized) {
      event.object.text = sanitized;
    }
    const parsed = Number(sanitized);
    const value = Number.isFinite(parsed) ? parsed : 0;

    if (type === 'carRental') {
      this.carRentalAmount = value;
      this.carRentalAmountText = sanitized;
    } else if (type === 'toolRental') {
      this.toolRentalAmount = value;
      this.toolRentalAmountText = sanitized;
    } else if (type === 'meterRent') {
      this.meterRentAmount = value;
      this.meterRentAmountText = sanitized;
    } else {
      this.billingPlatformAmount = value;
      this.billingPlatformAmountText = sanitized;
    }
  }

  public onAmountBlur(type: PayrollAmountType): void {
    if (type === 'carRental') {
      this.carRentalAmountText = this.formatPriceInput(this.carRentalAmount);
    } else if (type === 'toolRental') {
      this.toolRentalAmountText = this.formatPriceInput(this.toolRentalAmount);
    } else if (type === 'meterRent') {
      this.meterRentAmountText = this.formatPriceInput(this.meterRentAmount);
    } else {
      this.billingPlatformAmountText = this.formatPriceInput(this.billingPlatformAmount);
    }
    this.focusedInputs = Math.max(0, this.focusedInputs - 1);
    if (!this.focusedInputs) {
      this.pricesScrollHeight = 'auto';
    }
  }

  public onPriceFocus(index: number): void {
    this.onInputTap();
    this.focusedInputs += 1;
    this.pricesScrollHeight = Math.max(200, (this.page.getMeasuredHeight() || 700) - 430);
    this.cdr.detectChanges();
    setTimeout(() => {
      const scroll = this.pricesScrollRef?.nativeElement;
      scroll?.scrollToVerticalOffset(Math.max(0, (Number(index) * 80) - 110), true);
    }, 90);
  }

  public onFundWeeksChanged(value: number): void {
    this.fundWeeks = Number(value || 0);
  }

  public onPayDayChanged(event: any): void {
    const index = Number(event?.value ?? event);
    this.payDay = Number.isNaN(index) || index < 0 ? -1 : Math.min(6, index);
  }

  private loadPayrollSettings(): void {
    if (this.isSaveLoading) {
      return;
    }

    this.isSaveLoading = true;
    this.cdr.detectChanges();
    this.payrollService.getPayrollSettings().subscribe({
      next: (response) => {
        if (response?.error) {
          this.showPayrollError(response?.message || 'Unable to load payroll settings.');
          return;
        }

        this.fundWeeks = Math.max(0, Math.min(52, Number(response?.data?.fundWeeks || 0)));
        const payday = response?.data?.payday;
        this.payDay = payday === null || payday === undefined
          ? -1
          : Math.max(0, Math.min(6, Number(payday)));
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to load payroll settings.'
        );
        this.showPayrollError(message);
      },
      complete: () => {
        this.finishLoading();
      },
    });
  }

  private savePayrollSettings(): void {
    if (this.isSaveLoading) {
      return;
    }

    Utils.dismissKeyboard();
    this.isSaveLoading = true;
    this.cdr.detectChanges();
    const settings = {
      fundWeeks: Math.max(0, Math.min(52, Number(this.fundWeeks || 0))),
      payday: this.payDay >= 0 ? this.payDay : null,
    };

    this.payrollService.updatePayrollSettings(settings).subscribe({
      next: (response) => {
        if (response?.error) {
          this.showPayrollError(response?.message || 'Unable to save payroll settings.');
          return;
        }

        const data = response?.data;
        if (data) {
          this.fundWeeks = Math.max(0, Math.min(52, Number(data.fundWeeks || 0)));
          this.payDay = data.payday === null || data.payday === undefined
            ? -1
            : Math.max(0, Math.min(6, Number(data.payday)));
        }
        alert({
          title: 'Saved',
          message: response?.message || 'Payroll settings saved successfully.',
          okButtonText: 'OK',
        });
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to save payroll settings.'
        );
        this.showPayrollError(message);
      },
      complete: () => {
        this.finishLoading();
      },
    });
  }

  private showPayrollError(message: string): void {
    this.finishLoading();
    alert({ title: 'Payroll', message, okButtonText: 'OK' });
  }

  private finishLoading(): void {
    this.isSaveLoading = false;
    this.cdr.detectChanges();
  }

  private sanitizePriceInput(value: string): string {
    const clean = value.replace(/[^0-9.]/g, '');
    const firstDot = clean.indexOf('.');
    if (firstDot < 0) {
      return clean;
    }
    return `${clean.slice(0, firstDot + 1)}${clean.slice(firstDot + 1).replace(/\./g, '')}`;
  }

  private formatPriceInput(value: number): string {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '0.00';
  }

  private isTextInputTap(event: any): boolean {
    const iosClass = String(event?.ios?.view?.className || '');
    const androidClass = String(event?.android?.view?.getClass?.()?.getName?.() || '');
    return iosClass.includes('UITextField') ||
      iosClass.includes('UITextView') ||
      androidClass.includes('EditText');
  }

  private syncTheme(): void {
    const appearance = Application.systemAppearance();
    if (appearance === 'dark' || appearance === 'light') {
      this.isDarkTheme = appearance === 'dark';
      return;
    }
    this.isDarkTheme = String(this.page.className || '').includes('ns-dark');
  }
}
