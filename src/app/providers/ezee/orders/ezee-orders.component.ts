import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { ModalDialogService, NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { Application, ObservableArray, Page, Screen, SegmentedBarItem, Utils, alert } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { Subscription } from 'rxjs';
import { EzeeOrdersService } from './ezee-orders.service';
import { EzeeOrderListItem } from './ezee-order.model';
import { MenuEvent } from '../../../shared/components/menu-button/common';
import { Item } from '../../../shared/components/menu-button/item';
import { ConfigService } from '../../../shared/services/config.service';
import { CustomerInfoComponent } from '../../../customer-info/customer-info.component';

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
  private isCopyMenuOpen = false;
  private lastCopyMenuTs = 0;
  private appearanceChangedHandler?: () => void;
  private readonly subscriptions = new Subscription();

  constructor(
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef,
    private page: Page,
    private configService: ConfigService,
    private routerExtensions: RouterExtensions,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef
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
    if (!order) {
      return;
    }

    const modalWidth = Math.min(380, Math.max(300, Screen.mainScreen.widthDIPs - 32));
    const modalHeight = Math.min(620, Math.max(420, Screen.mainScreen.heightDIPs - 120));
    const phones = order.customer?.phones || [];
    const emails = order.customer?.emails || [];
    const customerContext = {
      ...order,
      accountNumber: order.customer?.subscriberNumber,
      hideSurveyNumber: true,
      hideXfinityAppUsername: true,
      hideSurveyActions: true,
      customer: {
        ...order.customer,
        homePhoneNumber: phones[0]?.value || null,
        callFirstPhoneNumber: phones[0]?.value || null,
        workPhoneNumber: phones[1]?.value || null,
        surveyPhoneNumber: phones[0]?.value || null,
        xfinityAppUsername: order.customer?.subscriberNumber || null,
        email: emails[0]?.value || null,
      },
    };

    const options: any = {
      context: customerContext,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
        width: modalWidth,
        height: modalHeight,
      },
    };

    this.modalService.showModal(CustomerInfoComponent, options).catch((error) => {
      console.log('[EzeeOrders] Failed to open customer info modal', error);
      alert({
        title: 'Customer Info',
        message: 'Unable to open customer information.',
        okButtonText: 'OK',
      });
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

  public showMenu(args: any, value: unknown, type?: string): void {
    if (args && typeof args.cancel === 'boolean') {
      args.cancel = true;
    }

    const now = Date.now();
    if (this.isCopyMenuOpen || now - this.lastCopyMenuTs < 500) {
      return;
    }

    const textToCopy = String(value ?? '').trim();
    if (!textToCopy) {
      return;
    }

    if (!__IOS__) {
      Utils.copyToClipboard(textToCopy);
      return;
    }

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
    const menu = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      this.getCopyMenuTitle(type),
      textToCopy,
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
    menu.addAction(copyAction);

    if (type === 'address') {
      const goAction = UIAlertAction.actionWithTitleStyleHandler(
        'Go',
        UIAlertActionStyle.Default,
        () => {
          this.isCopyMenuOpen = false;
          this.showMapOptions(sourceView, textToCopy);
        }
      );
      goAction.setValueForKey(UIImage.systemImageNamed('location'), 'image');
      menu.addAction(goAction);
    }

    menu.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, () => {
        this.isCopyMenuOpen = false;
      })
    );

    const popover = menu.popoverPresentationController;
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

    viewController.presentViewControllerAnimatedCompletion(menu, true, null);
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

  private getCopyMenuTitle(type?: string): string {
    if (!type) {
      return 'Copy';
    }
    const normalized = String(type).trim().toLowerCase();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Copy';
  }

  private showMapOptions(sourceView: UIView | undefined, address: string): void {
    if (!__IOS__) {
      return;
    }

    let viewController = Application.ios?.rootController;
    while (
      viewController &&
      viewController.presentedViewController &&
      !viewController.presentedViewController.beingDismissed
    ) {
      viewController = viewController.presentedViewController;
    }
    if (!viewController?.view) {
      return;
    }

    const menu = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      'Open With',
      address,
      UIAlertControllerStyle.ActionSheet
    );

    const appleAction = UIAlertAction.actionWithTitleStyleHandler(
      'iOS Map',
      UIAlertActionStyle.Default,
      () => Utils.openUrl(`http://maps.apple.com/?q=${encodeURIComponent(address)}`)
    );
    appleAction.setValueForKey(UIImage.systemImageNamed('map'), 'image');
    menu.addAction(appleAction);

    const googleAction = UIAlertAction.actionWithTitleStyleHandler(
      'Google Map',
      UIAlertActionStyle.Default,
      () => {
        const query = encodeURIComponent(address);
        const opened = Utils.openUrl(`comgooglemaps://?q=${query}`);
        if (!opened) {
          Utils.openUrl(`https://www.google.com/maps/search/?api=1&query=${query}`);
        }
      }
    );
    googleAction.setValueForKey(UIImage.systemImageNamed('globe'), 'image');
    menu.addAction(googleAction);

    menu.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, null)
    );

    const popover = menu.popoverPresentationController;
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

    viewController.presentViewControllerAnimatedCompletion(menu, true, null);
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
