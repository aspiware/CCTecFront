import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, isAndroid, isIOS, Page, Screen, ScrollView, Utils, alert } from '@nativescript/core';
import { forkJoin, of } from 'rxjs';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { SettingsService } from '../settings/settings.service';
import { UserModel } from '../shared/models/user.model';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from '../today/today.service';

@Component({
  standalone: true,
  selector: 'app-xh-job-prices',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './xh-job-prices.component.html',
  styleUrl: './xh-job-prices.component.scss',
})
export class XhJobPricesComponent implements OnInit, OnDestroy {
  private readonly categoryId = 2;
  @ViewChild('pricesScroll', { static: false }) private pricesScrollRef?: ElementRef<ScrollView>;
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public isLoading = false;
  public jobTypes: any[] = [];
  public user: UserModel | null = null;
  public equipmentPrices: any[] = [];
  public equipmentRows: any[][] = [];
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
    private todayService: TodayService,
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
    this.loadJobTypes();
    this.loadEquipments();
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

    const jobTypePrices = this.jobTypes.map((item: any) => ({
      userId,
      id: Number(item?.id || 0),
      jobTypeId: Number(item?.jobTypeId || 0),
      price: Number(item?.price || 0),
    }));

    const saveJobTypePrices$ = jobTypePrices.length
      ? this.settingsService.saveJobTypePrice(jobTypePrices)
      : of(null);

    this.isSaveLoading = true;
    this.cdr.detectChanges();

    forkJoin({
      equipment: this.todayService.saveEquipmentPrices(
        userId,
        this.categoryId,
        this.equipmentPrices.map((item: any) => ({
          equipmentId: Number(item?.id || item?.equipmentId || 0),
          price: Number(item?.price || 0),
        })).filter((item) => item.equipmentId > 0)
      ),
      jobTypes: saveJobTypePrices$,
    }).subscribe({
      next: async () => {
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.showSavedPopupAnchored();
        }, 0);
      },
      error: async (error) => {
        console.log('[XhJobPrices] saveChanges error', error);
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

  private loadEquipments(): void {
    const userId = Number(this.user?.userId || 0);
    if (!userId) {
      this.equipmentPrices = [];
      this.cdr.detectChanges();
      return;
    }

    this.todayService.getEquipmentsByCategory(userId, this.categoryId).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        this.equipmentPrices = list.map((item: any) => ({
          id: Number(item?.equipmentId || item?.id || 0),
          name: String(item?.equipmentName || item?.name || '-'),
          description: String(item?.equipmentDescription || item?.description || ''),
          sortOrder: Number(item?.sortOrder || 0),
          key: this.getEquipmentKey(item),
          price: Number(item?.price || 0),
          editablePrice: this.formatPriceInput(item?.price),
        }))
        .sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0));
        this.equipmentRows = this.chunkEquipmentRows(this.equipmentPrices);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[XhJobPrices] getEquipmentsByCategory error', error);
        this.equipmentPrices = [];
        this.cdr.detectChanges();
      },
    });
  }

  private refreshData(): void {
    this.endEditingBeforeRefresh();
    this.loadJobTypes();
    this.loadEquipments();
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

    this.todayService.getJobPricesByUser(userId, this.categoryId).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        this.jobTypes = list.map((item: any) => ({
          id: Number(item?.userJobTypePriceId || 0),
          jobTypeId: Number(item?.jobTypeId || 0),
          name: item?.name || item?.description || '-',
          price: Number(item?.price || 0),
          editablePrice: this.formatPriceInput(item?.price),
        }));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[XhJobPrices] getJobPricesByUser error', error);
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

  public onEquipmentPriceChange(item: any, event: any): void {
    const rawValue = String(event?.value ?? '');
    const sanitized = this.sanitizePriceInput(rawValue);
    if (event?.object && event.object.text !== sanitized) {
      event.object.text = sanitized;
    }

    const parsed = Number(sanitized);
    item.editablePrice = sanitized;
    item.price = Number.isFinite(parsed) ? parsed : 0;
  }

  public onEquipmentPriceFocus(): void {
    this.onInputTap();
    this.focusedInputs += 1;
    this.reduceScrollHeightForKeyboard();
  }

  public onEquipmentPriceBlur(item: any): void {
    item.editablePrice = this.formatPriceInput(item?.price || 0);
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

  public trackByJobTypeId(index: number, item: any): number {
    return Number(item?.id || index);
  }

  public trackByEquipmentId(index: number, item: any): number {
    return Number(item?.id || index);
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
      const anchorView = this.page.getViewById('xh-main-menu-btn') as any;
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
      console.log('[XhJobPrices] showSavedPopupAnchored error', error);
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

  private getEquipmentKey(item: any): string {
    const text = String(
      item?.equipmentName ||
      item?.name ||
      item?.equipmentDescription ||
      item?.description ||
      ''
    ).toLowerCase();
    if (text.includes('modem') || text.includes('mta') || text.includes('hsi') || text.includes('cm')) {
      return 'modem';
    }
    if (text.includes('tv') || text.includes('box') || text.includes('stb')) {
      return 'tvBox';
    }
    return `equipment-${item?.id || text}`;
  }

  private chunkEquipmentRows(items: any[]): any[][] {
    const rows: any[][] = [];
    for (let index = 0; index < items.length; index += 2) {
      rows.push(items.slice(index, index + 2));
    }
    return rows;
  }
}
