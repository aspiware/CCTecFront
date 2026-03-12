import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, isAndroid, isIOS, Page, Screen, ScrollView, Utils } from '@nativescript/core';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { UserModel } from '../shared/models/user.model';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from '../today/today.service';

@Component({
  standalone: true,
  selector: 'app-residential-job-prices',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './residential-job-prices.component.html',
  styleUrl: './residential-job-prices.component.scss',
})
export class ResidentialJobPricesComponent implements OnInit, OnDestroy {
  @ViewChild('pricesScroll', { static: false }) private pricesScrollRef?: ElementRef<ScrollView>;
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public isLoading = false;
  public jobTypes: any[] = [];
  public user: UserModel | null = null;
  public pricesScrollHeight: number | string = '100%';
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
    private todayService: TodayService,
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
    this.loadJobTypes();
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

    this.isSaveLoading = true;

    // Placeholder save flow until backend wiring is added.
    setTimeout(() => {
      this.isSaveLoading = false;
    }, 1200);
  }

  private refreshData(): void {
    this.loadJobTypes();
  }

  private loadJobTypes(): void {
    const userId = Number(this.user?.userId || 0);
    if (!userId) {
      this.isLoading = false;
      this.jobTypes = [];
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.todayService.getJobPricesByUser(userId, 'Residential', true).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        this.jobTypes = list.map((item: any) => ({
          id: Number(item?.jobTypeId || item?.id || 0),
          name: item?.name || item?.description || '-',
          price: Number(item?.price || 0),
          editablePrice: this.formatPriceInput(item?.price),
        }));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[ResidentialJobPrices] getJobPricesByUser error', error);
        this.jobTypes = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  public onPriceChange(item: any, event: any): void {
    if (!item) {
      return;
    }
    const rawValue = String(event?.value ?? '');
    const sanitized = this.sanitizePriceInput(rawValue);
    if (event?.object && event.object.text !== sanitized) {
      event.object.text = sanitized;
    }
    item.editablePrice = sanitized;
    const parsed = Number(sanitized);
    item.price = Number.isFinite(parsed) ? parsed : 0;
  }

  public onPriceBlur(item: any): void {
    if (!item) {
      return;
    }
    item.editablePrice = this.formatPriceInput(item.price);
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
    this.pricesScrollHeight = '100%';
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
