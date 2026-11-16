import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { Application, ObservableArray, Page, SegmentedBarItem, Utils, alert } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { Subscription } from 'rxjs';
import { EzeeOrdersService } from './ezee-orders.service';
import { EzeeOrderListItem } from './ezee-order.model';
import { MenuEvent } from '../../../shared/components/menu-button/common';
import { Item } from '../../../shared/components/menu-button/item';
import { ConfigService } from '../../../shared/services/config.service';

@Component({
  standalone: true,
  selector: 'app-ezee-orders',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-orders.component.html',
  styleUrl: '../../../today/today.component.scss',
})
export class EzeeOrdersComponent implements OnInit, OnDestroy {
  public orders = new ObservableArray<EzeeOrderListItem>([]);
  public isLoading = false;
  public errorMessage = '';
  public reportDate = '';
  public reportDateValue = new Date();
  public todayDate = new Date();
  public pendingCount = 0;
  public completedCount = 0;
  public ordersSearch = '';
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public mainMenuIconName = 'ellipsis.circle';
  public isTechStatusLoading = false;
  public isOnShift = true;
  public statusFilterItems: SegmentedBarItem[] = [];
  public selectedStatusFilterIndex = 0;
  public item: any;
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      { name: 'Available', icon: 'checkmark.circle.fill' },
      { name: 'Lunch', icon: 'fork.knife.circle.fill' },
      { name: 'Tech Log', icon: 'network' },
      { name: 'Meeting', icon: 'inset.filled.rectangle.and.person.filled' },
      { name: 'Logged On', icon: 'iphone.and.arrow.right.outward' },
      { name: 'End of Day', icon: 'circle.slash.fill' },
    ],
  };
  public mainMenuR: Item = {
    name: 'Main Menu Right',
    options: [
      { name: 'Location', icon: 'mappin.and.ellipse' },
      { name: 'Gate Codes', icon: 'square.grid.3x3' },
      { name: 'Customer Consent', icon: 'signature' },
      { name: 'Order Tools', icon: 'waveform.path.ecg.rectangle' },
      { name: 'Report Bug', icon: 'bubble.left.and.exclamationmark.bubble.right' },
      {
        name: 'Log Out',
        icon: 'person.crop.circle.badge.xmark',
        destructive: true,
        confirm: {
          title: 'Are you sure you want to log out?',
          confirmText: 'Yes',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      },
    ],
  };
  private allOrders: EzeeOrderListItem[] = [];
  private readonly actionTapStates: Record<string, boolean> = {};
  private readonly actionTapTimers: Record<string, any> = {};
  private appearanceChangedHandler?: () => void;
  private readonly subscriptions = new Subscription();

  constructor(
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef,
    private page: Page,
    private configService: ConfigService,
    private routerExtensions: RouterExtensions
  ) {}

  public ngOnInit(): void {
    this.syncTheme();
    this.statusFilterItems = ['All', 'Pending', 'Completed'].map((label) => {
      const item = new SegmentedBarItem();
      item.title = label;
      return item;
    });
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);

    this.subscriptions.add(this.ordersService.orders$.subscribe((orders) => {
      this.allOrders = orders;
      this.applyOrdersFilter();
      this.cdr.detectChanges();
    }));
    this.subscriptions.add(this.ordersService.loading$.subscribe((isLoading) => {
      this.isLoading = isLoading;
      this.cdr.detectChanges();
    }));
    this.subscriptions.add(this.ordersService.summary$.subscribe((summary) => {
      this.reportDate = summary.date;
      if (summary.date) {
        this.reportDateValue = new Date(`${summary.date}T12:00:00`);
      }
      this.pendingCount = summary.pending.count;
      this.completedCount = summary.completed.count;
      this.cdr.detectChanges();
    }));
    this.subscriptions.add(this.ordersService.error$.subscribe((message) => {
      this.errorMessage = message;
      this.cdr.detectChanges();
    }));
    this.ordersService.loadToday();
  }

  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
    Object.values(this.actionTapTimers).forEach((timer) => clearTimeout(timer));
  }

  public refresh(): void {
    this.ordersService.loadToday();
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    const selected = this.mainMenu.options[event?.index ?? 0];
    if (selected?.icon) {
      this.mainMenuIconName = selected.icon;
    }
    this.showUnavailable(`${selected?.name || 'Technician status'} is not connected for Ezee Fiber yet.`);
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    const selected = this.mainMenuR.options[event?.index ?? 0];
    if (event?.index === 5) {
      this.configService.logout();
      this.routerExtensions.navigate(['/login'], { clearHistory: true });
      return;
    }
    this.showUnavailable(`${selected?.name || 'This option'} is not connected for Ezee Fiber yet.`);
  }

  public selected(_event: MenuEvent, _item?: any): void {
    this.showUnavailable('Lunch actions are not connected for Ezee Fiber yet.');
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onPullToRefresh(event: any): void {
    const listView = event?.object;
    this.ordersService.loadToday(() => {
      listView?.notifyPullToRefreshFinished?.();
      listView?.scrollToIndex?.(0, false);
    });
  }

  public onOrdersSearchChange(value: string): void {
    this.ordersSearch = String(value || '');
    this.applyOrdersFilter();
  }

  public clearOrdersSearch(): void {
    if (!this.ordersSearch) {
      return;
    }
    this.ordersSearch = '';
    this.applyOrdersFilter();
  }

  public onStatusFilterChanged(event: any): void {
    const index = Number(event?.value);
    if (Number.isNaN(index) || index < 0 || index > 2) {
      return;
    }
    this.selectedStatusFilterIndex = index;
    this.applyOrdersFilter();
  }

  public orderTitle(order: EzeeOrderListItem): string {
    return `Order #${order.number}`;
  }

  public orderTime(order: EzeeOrderListItem): string {
    if (!order.timeFrom && !order.timeTo) {
      return 'Time not specified';
    }
    return `${order.timeFrom || '-'} - ${order.timeTo || '-'}`;
  }

  public statusClass(order: EzeeOrderListItem): string {
    return order.workflowStatus === 'Completed' ? 'status-closed' : 'status-open';
  }

  public statusIcon(order: EzeeOrderListItem): string {
    return order.workflowStatus === 'Completed' ? '\uf058' : '\uf017';
  }

  public markActionTap(order: EzeeOrderListItem, action: string): void {
    const key = `${order.number}:${action}`;
    this.actionTapStates[key] = true;
    this.cdr.detectChanges();
    if (this.actionTapTimers[key]) {
      clearTimeout(this.actionTapTimers[key]);
    }
    this.actionTapTimers[key] = setTimeout(() => {
      this.actionTapStates[key] = false;
      this.cdr.detectChanges();
    }, 160);
  }

  public isActionTapped(order: EzeeOrderListItem, action: string): boolean {
    return !!this.actionTapStates[`${order.number}:${action}`];
  }

  public showCustomer(order: EzeeOrderListItem): void {
    const customer = order.customer;
    const phone = customer?.phones?.[0]?.value || '-';
    const email = customer?.emails?.[0]?.value || '-';
    alert({
      title: customer?.fullName || 'Customer',
      message: [
        `Subscriber: ${customer?.subscriberNumber || '-'}`,
        `Status: ${customer?.status || '-'}`,
        `Phone: ${phone}`,
        `Email: ${email}`,
      ].join('\n'),
      okButtonText: 'OK',
    });
  }

  public callCustomer(order: EzeeOrderListItem): void {
    const phone = order.customer?.phones?.[0]?.value;
    if (!phone) {
      this.showUnavailable('No phone number is available for this customer.');
      return;
    }
    Utils.openUrl(`tel:${String(phone).replace(/[^\d+]/g, '')}`);
  }

  public emailCustomer(order: EzeeOrderListItem): void {
    const email = order.customer?.emails?.[0]?.value;
    if (!email) {
      this.showUnavailable('No email address is available for this customer.');
      return;
    }
    Utils.openUrl(`mailto:${encodeURIComponent(email)}`);
  }

  public openMap(order: EzeeOrderListItem): void {
    if (!order.address) {
      this.showUnavailable('No address is available for this order.');
      return;
    }
    const address = encodeURIComponent(order.address);
    Utils.openUrl(`https://www.google.com/maps/search/?api=1&query=${address}`);
  }

  public showOrderDetails(order: EzeeOrderListItem): void {
    alert({
      title: this.orderTitle(order),
      message: [
        `Status: ${order.workflowStatus}`,
        `Work type: ${order.workType || '-'}`,
        `Reason: ${order.initialReason || '-'}`,
        `Work units: ${order.workUnits ?? '-'}`,
        `Time: ${this.orderTime(order)}`,
      ].join('\n'),
      okButtonText: 'OK',
    });
  }

  public wifiConfig(_order: EzeeOrderListItem): void {
    this.showUnavailable('Wi-Fi configuration is not connected for Ezee Fiber yet.');
  }

  public showEditOrder(_order: EzeeOrderListItem): void {
    this.showUnavailable('Order editing is not connected for Ezee Fiber yet.');
  }

  public showDevices(_order: EzeeOrderListItem): void {
    this.showUnavailable('Devices are not connected for Ezee Fiber yet.');
  }

  public activateService(_order: EzeeOrderListItem): void {
    this.showUnavailable('Service activation is not connected for Ezee Fiber yet.');
  }

  public copyValue(value: unknown): void {
    const text = String(value || '').trim();
    if (text) {
      Utils.copyToClipboard(text);
    }
  }

  private applyOrdersFilter(): void {
    const query = this.ordersSearch.trim().toLowerCase();
    const selectedStatus = this.selectedStatusFilterIndex === 1
      ? 'Pending'
      : this.selectedStatusFilterIndex === 2
        ? 'Completed'
        : null;
    const source = selectedStatus
      ? this.allOrders.filter((order) => order.workflowStatus === selectedStatus)
      : this.allOrders;
    const filtered = !query
      ? [...source]
      : source.filter((order) => [
          order.number,
          order.workType,
          order.address,
          order.workflowStatus,
          order.customer?.fullName,
          order.customer?.subscriberNumber,
        ].some((value) => String(value || '').toLowerCase().includes(query)));
    this.orders = new ObservableArray(filtered);
  }

  private showUnavailable(message: string): void {
    alert({ title: 'Orders', message, okButtonText: 'OK' });
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
