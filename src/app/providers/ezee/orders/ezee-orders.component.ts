import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { ModalDialogService, NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { Application, ObservableArray, Page, Screen, SegmentedBarItem, Utils, alert } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { finalize, Subscription } from 'rxjs';
import { EzeeOrdersService } from './ezee-orders.service';
import { EzeeOrderListItem } from './ezee-order.model';
import { MenuEvent } from '../../../shared/components/menu-button/common';
import { Item } from '../../../shared/components/menu-button/item';
import { ConfigService } from '../../../shared/services/config.service';
import { CustomerInfoComponent } from '../../../customer-info/customer-info.component';
import { EzeeEditOrderComponent } from './ezee-edit-order.component';
import { EzeeOrderHistoryComponent } from './ezee-order-history.component';
import { AddNoteComponent } from '../../../add-note/add-note.component';
import { EzeeFinalizeOrderComponent } from './ezee-finalize-order.component';
import { EzeeFinalizeReason } from './ezee-order.model';
import { EzeeSummaryService } from '../home/ezee-summary.service';
import { EzeeOrderEquipmentComponent } from './ezee-order-equipment.component';

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
  public todayTotal = 0;
  public weekTotal = 0;
  public totalUnits = 0;
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
  public orderMenu: Item = {
    name: 'Order Menu',
    options: [
      { name: 'Go Enroute', icon: 'car.fill' },
      { name: 'Go In Progress', icon: 'wrench.fill' },
      { name: 'Pre-Provision', icon: 'shippingbox.fill' },
      { name: 'Add Note', icon: 'note.text.badge.plus' },
      { name: 'Finalize', icon: 'checkmark.circle.fill' },
    ],
  };
  private allOrders: EzeeOrderListItem[] = [];
  private readonly actionTapStates: Record<string, boolean> = {};
  private readonly actionTapTimers: Record<string, any> = {};
  private readonly addingNoteOrders = new Set<string>();
  private readonly finalizingOrders = new Set<string>();
  private readonly updatingStatusOrders = new Set<string>();
  private readonly selectedFinalizeReasons = new Map<string, EzeeFinalizeReason>();
  private isCopyMenuOpen = false;
  private lastCopyMenuTs = 0;
  private isErrorAlertOpen = false;
  private appearanceChangedHandler?: () => void;
  private readonly subscriptions = new Subscription();

  constructor(
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef,
    private page: Page,
    private configService: ConfigService,
    private routerExtensions: RouterExtensions,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef,
    private summaryService: EzeeSummaryService
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
      this.todayTotal = orders.reduce((total, order) => {
        const orderTotal = Number(order.pricing?.total);
        return total + (Number.isFinite(orderTotal) ? orderTotal : 0);
      }, 0);
      this.totalUnits = orders.reduce((total, order) => {
        const orderUnits = Number(order.workUnits);
        return total + (Number.isFinite(orderUnits) ? orderUnits : 0);
      }, 0);
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
      if (message) {
        this.showOrdersError(message);
      }
    }));
    this.ordersService.loadToday();
    this.loadWeeklyTotal();
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
    this.loadWeeklyTotal(true);
  }

  private async showOrdersError(message: string): Promise<void> {
    if (this.isErrorAlertOpen) {
      return;
    }

    this.isErrorAlertOpen = true;
    try {
      await alert({
        title: 'Unable to Load Orders',
        message,
        okButtonText: 'OK',
      });
      if (this.isSessionExpiredError(message) && this.errorMessage === message) {
        this.configService.logout();
        this.routerExtensions.navigate(['/login'], { clearHistory: true });
      }
    } finally {
      this.isErrorAlertOpen = false;
    }
  }

  private isSessionExpiredError(message: string): boolean {
    return /session expired|sign in again|unauthorized/i.test(String(message || ''));
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

  public onSelectedOrderMenu(event: MenuEvent, order: EzeeOrderListItem): void {
    const selected = this.orderMenu.options[event?.index ?? 0];
    if (event?.index === 0) {
      this.setOrderEnroute(order);
      return;
    }
    if (event?.index === 1) {
      this.setOrderInProgress(order);
      return;
    }
    if (event?.index === 2) {
      this.showUnavailable('Pre-Provision is not connected for Ezee Fiber yet.');
      return;
    }
    if (event?.index === 3) {
      this.openAddNoteModal(order);
      return;
    }
    if (event?.index === 4) {
      this.openFinalizeModal(order);
      return;
    }
    this.showUnavailable(
      `${selected?.name || 'This order action'} is not connected for Ezee Fiber yet.`
    );
  }

  public openFinalizeModal(order: EzeeOrderListItem): void {
    if (!order || this.isOrderMenuLoading(order)) {
      return;
    }

    const selectedReason = this.selectedFinalizeReasons.get(order.number);
    const options: any = {
      context: {
        order,
        selectedReasonId: selectedReason?.reasonId,
      },
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
      },
    };

    this.modalService.showModal(EzeeFinalizeOrderComponent, options).then((result) => {
      if (result?.reason && Number.isFinite(Number(result?.reasonId))) {
        const selectedReason = result as EzeeFinalizeReason;
        this.selectedFinalizeReasons.set(order.number, selectedReason);
        this.finalizeOrder(order, selectedReason);
      }
    }).catch((error) => {
      console.log('[EzeeOrders] Failed to open finalize modal', error);
      alert({
        title: 'Finalize Order',
        message: 'Unable to open the finalize options.',
        okButtonText: 'OK',
      });
    });
  }

  public isOrderMenuLoading(order: EzeeOrderListItem): boolean {
    return this.addingNoteOrders.has(order.number) ||
      this.finalizingOrders.has(order.number) ||
      this.updatingStatusOrders.has(order.number);
  }

  public openAddNoteModal(order: EzeeOrderListItem): void {
    if (!order || this.isOrderMenuLoading(order)) {
      return;
    }

    const options: any = {
      context: { note: '' },
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
      },
    };

    this.modalService.showModal(AddNoteComponent, options).then((result) => {
      if (typeof result !== 'string') {
        return;
      }
      const comment = result.trim();
      if (!comment) {
        alert({
          title: 'Add Note',
          message: 'Please enter a note before saving.',
          okButtonText: 'OK',
        });
        return;
      }
      this.saveOrderNote(order, comment);
    }).catch((error) => {
      console.log('[EzeeOrders] Failed to open add note modal', error);
      alert({
        title: 'Add Note',
        message: 'Unable to open the note editor.',
        okButtonText: 'OK',
      });
    });
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onPullToRefresh(event: any): void {
    const listView = event?.object;
    this.loadWeeklyTotal(true);
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
    const status = this.normalizedOrderStatus(order);
    if (status === 'enroute' || status === 'inprogress') {
      return 'status-current';
    }
    return order.workflowStatus === 'Completed' ? 'status-closed' : 'status-open';
  }

  public statusIcon(order: EzeeOrderListItem): string {
    const status = this.normalizedOrderStatus(order);
    if (status === 'enroute') {
      return '\uf1b9';
    }
    if (status === 'inprogress') {
      return '\uf0ad';
    }
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
    const customerName = order.customer?.firstName || order.customer?.fullName || 'customer';
    const appointmentTime = this.formatAppointmentTime(order.timeFrom);
    const customerContext = {
      ...order,
      accountNumber: order.customer?.subscriberNumber,
      hideSurveyNumber: true,
      hideXfinityAppUsername: true,
      hideSurveyActions: true,
      availabilitySmsText: {
        english: `Hi ${customerName}, this is your Ezee Fiber technician. I have your appointment scheduled for today at ${appointmentTime}. Would it be okay if I came earlier, possibly now?`,
        spanish: `Hola ${customerName}, soy tu técnico de Ezee Fiber. Tengo tu cita programada para hoy a las ${appointmentTime}. ¿Estaría bien si llego más temprano, posiblemente ahora?`,
      },
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

  public showOrderHistory(order: EzeeOrderListItem): void {
    if (!order) {
      return;
    }

    const options: any = {
      context: order,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
      },
    };

    this.modalService.showModal(EzeeOrderHistoryComponent, options).catch((error) => {
      console.log('[EzeeOrders] Failed to open order history modal', error);
      alert({
        title: 'Order History',
        message: 'Unable to open order history.',
        okButtonText: 'OK',
      });
    });
  }

  public showEditOrder(order: EzeeOrderListItem): void {
    if (!order) {
      return;
    }

    const options: any = {
      context: order,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
      },
    };

    this.modalService.showModal(EzeeEditOrderComponent, options).then((result) => {
      if (result) {
        this.ordersService.loadToday();
      }
    }).catch((error) => {
      console.log('[EzeeOrders] Failed to open edit order modal', error);
      alert({
        title: 'Edit Order',
        message: 'Unable to open order editing.',
        okButtonText: 'OK',
      });
    });
  }

  public showDevices(order: EzeeOrderListItem): void {
    if (!order) {
      return;
    }

    const options: any = {
      context: { order },
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
      },
    };

    this.modalService.showModal(EzeeOrderEquipmentComponent, options).catch((error) => {
      console.log('[EzeeOrders] Failed to open order equipment modal', error);
      alert({
        title: 'Order Equipment',
        message: 'Unable to open the order equipment.',
        okButtonText: 'OK',
      });
    });
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

  private loadWeeklyTotal(forceRefresh = false): void {
    this.subscriptions.add(
      this.summaryService.getCurrentWeek(forceRefresh).subscribe({
        next: (response) => {
          if (!response?.error) {
            this.weekTotal = Number(response?.data?.weeklyTotal || 0);
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.log('[EzeeOrders] Unable to load weekly total', error);
        },
      })
    );
  }

  private saveOrderNote(order: EzeeOrderListItem, comment: string): void {
    this.addingNoteOrders.add(order.number);
    this.cdr.detectChanges();

    this.ordersService.addNote(order.number, comment).pipe(
      finalize(() => {
        this.addingNoteOrders.delete(order.number);
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          alert({
            title: 'Add Note',
            message: response?.message || 'Unable to add the note.',
            okButtonText: 'OK',
          });
          return;
        }
        alert({
          title: 'Note Added',
          message: response?.message || 'Work order note added successfully.',
          okButtonText: 'OK',
        });
        this.ordersService.loadToday();
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to add the note.'
        );
        alert({ title: 'Add Note', message, okButtonText: 'OK' });
      },
    });
  }

  private finalizeOrder(order: EzeeOrderListItem, selectedReason: EzeeFinalizeReason): void {
    if (this.finalizingOrders.has(order.number)) {
      return;
    }

    this.finalizingOrders.add(order.number);
    this.cdr.detectChanges();

    this.ordersService.finalizeOrder(order.number, selectedReason).pipe(
      finalize(() => {
        this.finalizingOrders.delete(order.number);
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          alert({
            title: 'Finalize Order',
            message: response?.message || 'Unable to finalize the order.',
            okButtonText: 'OK',
          });
          return;
        }

        this.selectedFinalizeReasons.delete(order.number);
        const successMessage = response?.message || 'Work order finalized successfully.';
        const finalizedReason = String(response?.data?.reason || '').trim();
        alert({
          title: 'Order Finalized',
          message: finalizedReason
            ? `${successMessage}\nReason: ${finalizedReason}`
            : successMessage,
          okButtonText: 'OK',
        });
        this.ordersService.loadToday();
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to finalize the order.'
        );
        alert({ title: 'Finalize Order', message, okButtonText: 'OK' });
      },
    });
  }

  private setOrderEnroute(order: EzeeOrderListItem): void {
    if (!order || this.isOrderMenuLoading(order)) {
      return;
    }

    this.updatingStatusOrders.add(order.number);
    this.cdr.detectChanges();

    this.ordersService.setEnroute(order.number).pipe(
      finalize(() => {
        this.updatingStatusOrders.delete(order.number);
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          alert({
            title: 'Go Enroute',
            message: response?.message || 'Unable to change the order status.',
            okButtonText: 'OK',
          });
          return;
        }

        alert({
          title: 'Order Enroute',
          message: response?.message || 'Work order status changed to Enroute successfully.',
          okButtonText: 'OK',
        });
        this.updateOrderStatus(order, response?.data?.status || 'Enroute');
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to change the order status.'
        );
        alert({ title: 'Go Enroute', message, okButtonText: 'OK' });
      },
    });
  }

  private setOrderInProgress(order: EzeeOrderListItem): void {
    if (!order || this.isOrderMenuLoading(order)) {
      return;
    }

    this.updatingStatusOrders.add(order.number);
    this.cdr.detectChanges();

    this.ordersService.setInProgress(order.number).pipe(
      finalize(() => {
        this.updatingStatusOrders.delete(order.number);
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          alert({
            title: 'Go In Progress',
            message: response?.message || 'Unable to change the order status.',
            okButtonText: 'OK',
          });
          return;
        }

        alert({
          title: 'Order In Progress',
          message: response?.message || 'Work order status changed to In Progress successfully.',
          okButtonText: 'OK',
        });
        this.updateOrderStatus(order, response?.data?.status || 'In Progress');
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to change the order status.'
        );
        alert({ title: 'Go In Progress', message, okButtonText: 'OK' });
      },
    });
  }

  private updateOrderStatus(order: EzeeOrderListItem, status: string): void {
    const updatedOrder: EzeeOrderListItem = { ...order, status };
    const allOrdersIndex = this.allOrders.findIndex((item) => item.number === order.number);
    if (allOrdersIndex >= 0) {
      this.allOrders[allOrdersIndex] = updatedOrder;
    }

    const visibleOrderIndex = this.orders.findIndex((item) => item.number === order.number);
    if (visibleOrderIndex >= 0) {
      this.orders.setItem(visibleOrderIndex, updatedOrder);
    }
    this.cdr.detectChanges();
  }

  private normalizedOrderStatus(order: EzeeOrderListItem): string {
    return String(order.status || '').toLowerCase().replace(/[\s_-]+/g, '');
  }

  private showUnavailable(message: string): void {
    alert({ title: 'Orders', message, okButtonText: 'OK' });
  }

  private formatAppointmentTime(value: string | null): string {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
      return '10 AM';
    }

    const timeMatch = rawValue.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (!timeMatch) {
      return rawValue;
    }

    let hour = Number(timeMatch[1]);
    const minutes = timeMatch[2];
    let period = timeMatch[3]?.toUpperCase();

    if (!period) {
      period = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
    }

    return `${hour}${minutes === '00' ? '' : `:${minutes}`} ${period}`;
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
