import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Dialogs } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from '../today/today.service';
import { concatMap, finalize } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-remove-devices',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './remove-devices.component.html',
  styleUrl: './remove-devices.component.scss',
})
export class RemoveDevicesComponent implements OnInit, OnDestroy {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public job: any;
  public workOrder: any;
  public devices: any[] = [];
  public isRefreshingMainMenu = false;
  public removingDeviceKeys: { [key: string]: boolean } = {};
  private userId = 0;
  private appearanceChangedHandler?: () => void;
  private actionTapStates: { [key: string]: boolean } = {};
  private actionTapTimers: { [key: string]: ReturnType<typeof setTimeout> } = {};
  private loadingStates: { [key: string]: boolean } = {};
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      {
        name: 'Refresh',
        icon: 'arrow.clockwise',
        // destructive: true,
        // confirm: {
        //   title: 'Save note?',
        //   confirmText: 'Save',
        //   cancelText: 'Cancel',
        //   presentation: 'anchor',
        // },
      },
      {
        name: 'Add Place Holder',
        icon: 'plus.rectangle.on.rectangle',
        children: [
          {
            name: 'HSD',
            icon: 'wifi',
          },
          {
            name: 'VIDEO',
            icon: 'tv',
          },
          {
            name: 'VOICE',
            icon: 'phone',
          },
        ],
      },
    ],
  };

  constructor(
    private modalParams: ModalDialogParams,
    private usersService: UsersService,
    private todayService: TodayService,
    private cdr: ChangeDetectorRef,
  ) {
    const context = this.modalParams.context || {};
    this.job = context;
    this.workOrder = context;
    this.syncDevices(Array.isArray(this.job?.devices) ? this.job.devices : []);
    this.userId = Number(this.usersService.getUser()?.userId || 0);
  }

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
  }

  ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  get mainMenuOptions() {
    return this.mainMenu.options;
  }

  public closeWithoutSave(): void {
    this.modalParams.closeCallback({
      job: this.job,
    });
  }

  public onSelectedMainMenu(event: MenuEvent, _menuStatus?: any): void {
    const menuPath = event?.path || [event?.index];

    switch (menuPath?.[0]) {
      case 0:
        this.refreshDevices();
        break;
      case 1:
        switch (menuPath?.[1]) {
          case 0:
            this.onAddPlaceholder('HSD');
            break;
          case 1:
            this.onAddPlaceholder('VIDEO');
            break;
          case 2:
            this.onAddPlaceholder('CDV');
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }
  }

  private onAddPlaceholder(type: 'HSD' | 'VIDEO' | 'CDV'): void {
    const workOrderNumber = this.job?.workOrderNumber;
    const placeholderData = this.buildAddPlaceholderPayload(type);

    if (!this.userId || !workOrderNumber || !placeholderData || this.isRefreshingMainMenu) {
      return;
    }

    this.isRefreshingMainMenu = true;
    this.cdr.detectChanges();

    this.todayService
      .addPlaceHolder(this.userId, workOrderNumber, placeholderData)
      .pipe(
        concatMap(() => this.todayService.refreshOrderDetail(this.userId, workOrderNumber)),
        concatMap(() => this.todayService.getWorkOrderDetails(this.userId, workOrderNumber)),
        finalize(() => {
          this.isRefreshingMainMenu = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (details: any) => {
          this.applyWorkOrderDetails(details);
          this.cdr.detectChanges();
        },
        error: (error) => {
          Dialogs.alert({
            title: 'Add Place Holder',
            message: String(error?.error?.message || error?.message || 'Failed to add placeholder.'),
            okButtonText: 'OK',
          });
        },
      });
  }

  private buildAddPlaceholderPayload(type: 'HSD' | 'VIDEO' | 'CDV'): any {
    return {
      locationId: this.workOrder?.locationID,
      equipment: [
        {
          equipTypeCd: this.getPlaceholderEquipTypeCd(type),
          outlet: 'A',
          ownerCd: 'N',
          action: 'ADD',
          model: '',
          deviceType: '',
          lob: type,
          serialNumber: this.generatePlaceholderSerialNumber(),
          deviceName: '',
        },
      ],
      accountNumber: this.workOrder?.accountNumber,
      isWriteBackToDwbEnabled: false,
    };
  }

  private getPlaceholderEquipTypeCd(type: 'HSD' | 'VIDEO' | 'CDV'): string {
    switch (type) {
      case 'HSD':
        return 'J';
      case 'VIDEO':
        return 'N';
      case 'CDV':
        return 'W';
      default:
        return 'J';
    }
  }

  private generatePlaceholderSerialNumber(): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `*${randomDigits}`;
  }

  private refreshDevices(): void {
    if (this.isRefreshingMainMenu) {
      return;
    }

    const workOrderNumber = this.job?.workOrderNumber;
    if (!this.userId || !workOrderNumber) {
      Dialogs.alert({
        title: 'Refresh',
        message: 'Missing data to refresh devices.',
        okButtonText: 'OK',
      });
      return;
    }

    this.isRefreshingMainMenu = true;
    this.cdr.detectChanges();

    this.todayService
      .refreshOrderDetail(this.userId, workOrderNumber)
      .pipe(
        concatMap(() => this.todayService.getWorkOrderDetails(this.userId, workOrderNumber)),
        finalize(() => {
          this.isRefreshingMainMenu = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (details: any) => {
          this.applyWorkOrderDetails(details);
          this.cdr.detectChanges();
        },
        error: (error) => {
          Dialogs.alert({
            title: 'Refresh',
            message: String(error?.error?.message || error?.message || 'Failed to refresh devices.'),
            okButtonText: 'OK',
          });
        },
      });
  }

  public isModemType(item: any): boolean {
    const type = String(item?.type || '').toUpperCase();
    return type === 'MTA' || type === 'HSI' || type === 'CM';
  }

  public isVideoType(item: any): boolean {
    const type = String(item?.type || '').toUpperCase();
    return type === 'STB' || type === 'IPSTB';
  }

  public isDeviceConnected(item: any): boolean {
    const rawStatus = item?.connectionStatus;
    if (typeof rawStatus === 'boolean') {
      return rawStatus;
    }

    const status = String(rawStatus || '').trim().toLowerCase();
    if (!status) {
      return false;
    }

    return (
      status === 'true' ||
      status === '1' ||
      status === 'active' ||
      status === 'connected' ||
      status === 'online'
    );
  }

  public getDeviceMenuIcon(item: any): string {
    if (this.isModemType(item)) {
      return 'wifi';
    }
    if (this.isVideoType(item)) {
      return 'tv';
    }
    return 'ellipsis.circle';
  }

  public getDeviceMenuOptions(item: any): Item['options'] {
    if (this.isModemType(item)) {
      return [
        {
          name: 'Modem Status',
          icon: 'antenna.radiowaves.left.and.right',
        },
        {
          name: 'Activate Modem',
          icon: 'bolt.fill',
        },
        {
          name: 'Reboot Modem',
          icon: 'power',
        },
        {
          name: 'Remove',
          icon: 'trash',
          destructive: true,
          confirm: {
            title: 'Remove device?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            presentation: 'anchor',
          },
        },
      ];
    }

    if (this.isVideoType(item)) {
      return [
        {
          name: 'Send Init',
          icon: 'arrow.trianglehead.2.clockwise.rotate.90',
        },
        {
          name: 'Send Hit',
          icon: 'dot.radiowaves.left.and.right',
        },
        {
          name: 'Remove',
          icon: 'trash',
          destructive: true,
          confirm: {
            title: 'Remove device?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            presentation: 'anchor',
          },
        },
      ];
    }

    return [
      {
        name: 'Device Info',
        icon: 'info.circle',
      },
      {
        name: 'Remove',
        icon: 'trash',
        destructive: true,
        confirm: {
          title: 'Remove device?',
          confirmText: 'Remove',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      },
    ];
  }

  public onSelectedDeviceMenu(event: MenuEvent, item: any, anchor?: any): void {
    if (this.isModemType(item)) {
      switch (event?.index) {
        case 0:
          this.gatewayStatus(item, anchor);
          break;
        case 1:
          this.goToActivateService();
          break;
        case 2:
          this.rebootGateway(item, anchor);
          break;
        case 3:
          this.removeDevice(item);
          break;
        default:
          break;
      }
      return;
    }

    if (this.isVideoType(item)) {
      switch (event?.index) {
        case 0:
          this.showDeviceInfo(item, anchor);
          break;
        case 1:
          this.showVideoStatus(item, anchor);
          break;
        case 2:
          this.removeDevice(item);
          break;
        default:
          break;
      }
      return;
    }

    switch (event?.index) {
      case 0:
        this.showDeviceInfo(item, anchor);
        break;
      case 1:
        this.removeDevice(item);
        break;
      default:
        break;
    }
  }

  public goToActivateService(): void {
    this.modalParams.closeCallback({
      navigateToActivateService: true,
      job: this.job,
    });
  }

  private syncDevices(devices: any[]): void {
    const mirroredDevices = Array.isArray(devices) ? [...devices] : [];
    this.devices = mirroredDevices;

    if (this.job && typeof this.job === 'object') {
      this.job.devices = mirroredDevices;
    }
  }

  private removeDevice(item: any): void {
    const workOrderNumber = this.job?.workOrderNumber;
    const deviceKey = this.getDeviceKey(item);
    const deviceData = this.buildRemoveDevicePayload(item);

    if (!this.userId || !workOrderNumber || !deviceKey || !deviceData || this.removingDeviceKeys[deviceKey]) {
      return;
    }

    this.removingDeviceKeys[deviceKey] = true;
    this.cdr.detectChanges();

    this.todayService
      .removeDevice(this.userId, workOrderNumber, deviceData)
      .pipe(
        concatMap(() => this.todayService.refreshOrderDetail(this.userId, workOrderNumber)),
        concatMap(() => this.todayService.getWorkOrderDetails(this.userId, workOrderNumber)),
        finalize(() => {
          delete this.removingDeviceKeys[deviceKey];
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (details: any) => {
          this.applyWorkOrderDetails(details);
          this.cdr.detectChanges();
        },
        error: (error) => {
          Dialogs.alert({
            title: 'Remove Device',
            message: String(error?.error?.message || error?.message || 'Failed to remove device.'),
            okButtonText: 'OK',
          });
        },
      });
  }

  private applyWorkOrderDetails(details: any): void {
    this.workOrder = details;
    const refreshedDevices =
      details?.devices?.existingDevices?.deviceList ?? [];

    this.syncDevices(Array.isArray(refreshedDevices) ? refreshedDevices : []);
  }

  private buildRemoveDevicePayload(device: any): any {
    return {
      houseKey: this.job?.houseKey,
      customerId: this.job?.customerId,
      houseMiscKey: '',
      locationId: this.job?.locationId,
      jobClassCd: this.job?.Job?.JobClassCd,
      operation: '',
      isWriteBackToDwbEnabled: false,
      orderManagementSystem: 'ACP',
      equipment: [
        {
          deviceName: device?.deviceName || device?.name || '',
          designId: [],
          ownerCd: 'P',
          armObjectName: '',
          model: '',
          serviceServiceId: [],
          deviceType: device?.type || '',
          outlet: device?.outlet,
          equipTypeCd: device?.equipTypeCd,
          serviceTypes: [],
          action: 'REMOVE',
          serialNumber: device?.deviceSerialNumber || device?.serialNumber || '',
          isDoorbell: false,
          isIndoorCamera: false,
        },
      ],
      operations: ['REMOVE'],
      isWifiReadyJob: false,
      cameras: [],
      accessories: [],
      isSmartOfficeJob: false,
      accountNumber: this.job?.accountNumber,
    };
  }

  public markJobActionTap(item: any, action: string, autoClearMs = 140): void {
    const key = this.getActionKey(item, action);
    this.actionTapStates[key] = true;
    if (this.actionTapTimers[key]) {
      clearTimeout(this.actionTapTimers[key]);
    }
    if (autoClearMs > 0) {
      this.actionTapTimers[key] = setTimeout(() => {
        this.actionTapStates[key] = false;
      }, autoClearMs);
    }
  }

  public isJobActionTapped(item: any, action: string): boolean {
    return !!this.actionTapStates[this.getActionKey(item, action)];
  }

  public isJobMenuLoading(item: any): boolean {
    const key = this.getDeviceKey(item);
    return !!this.loadingStates[key] || !!this.removingDeviceKeys[key];
  }

  public onDevicesReordered(): void {
    this.syncDevices(this.devices);
    this.cdr.detectChanges();
  }

  public gatewayStatus(item: any, anchor?: any): void {
    const key = this.getDeviceKey(item);
    if (!key || this.loadingStates[key]) {
      return;
    }

    const mac = String(item?.mac || item?.deviceMac || '').trim();
    const workOrderNumber = this.job?.workOrderNumber;
    const accountNumber = this.job?.accountNumber;

    if (!this.userId || !mac || !workOrderNumber || !accountNumber) {
      Dialogs.alert({
        title: 'Gateway Status',
        message: 'Missing data to check gateway status.',
        okButtonText: 'OK',
      });
      return;
    }

    this.setGatewayLoading(key, true);
    this.todayService
      .gatewayStatus(this.userId, mac, workOrderNumber, accountNumber)
      .pipe(finalize(() => this.finishGatewayLoading(key)))
      .subscribe({
        next: (res: any) => {
          const friendlyName = String(res?.gatewayStatusFriendlyName || '').trim();
          const message = String(
            friendlyName ||
            res?.message ||
            res?.status ||
            res?.result ||
            'Gateway status checked.'
          );
          const canActivate = friendlyName === 'Fully Manageable';

          this.showGatewayStatusMessage(
            message,
            anchor,
            canActivate,
            0,
            () => this.gatewayStatus(item, anchor)
          );
        },
        error: (error) => {
          this.showGatewayStatusMessage(
            String(error?.error?.message || error?.message || 'Failed to check gateway status.'),
            anchor,
            false,
            0,
            () => this.gatewayStatus(item, anchor)
          );
        },
      });
  }

  rebootGateway(item: any, anchor?: any) { }

  private finishGatewayLoading(key: string): void {
    // Defer spinner state update to the next tick to avoid NG0100 in dev mode.
    setTimeout(() => {
      this.setGatewayLoading(key, false);
    }, 0);
  }

  private setGatewayLoading(key: string, isLoading: boolean): void {
    if (!key) {
      return;
    }
    this.loadingStates[key] = isLoading;
    this.cdr.detectChanges();
  }

  private getDeviceKey(item: any): string {
    return String(item?.id || item?.deviceId || item?.serialNumber || item?.deviceSerialNumber || '');
  }

  private getActionKey(item: any, action: string): string {
    return `${this.getDeviceKey(item)}:${action}`;
  }

  private showDeviceInfo(item: any, anchor?: any): void {
    const info = [
      `Type: ${String(item?.type || 'n/a')}`,
      `Name: ${String(item?.name || item?.deviceName || 'n/a')}`,
      `Serial: ${String(item?.serialNumber || item?.deviceSerialNumber || 'n/a')}`,
      `MAC: ${String(item?.mac || item?.deviceMac || 'n/a')}`,
    ].join('\n');
    this.showGatewayStatusMessage(info, anchor);
  }

  private showVideoStatus(item: any, anchor?: any): void {
    const status = this.isDeviceConnected(item) ? 'Connected' : 'Disconnected';
    this.showGatewayStatusMessage(`Video status: ${status}`, anchor);
  }

  private showGatewayStatusMessage(
    message: string,
    anchor?: any,
    canActivate = false,
    autoDismissMs = 2000,
    onRetry?: () => void
  ): void {
    const title = 'Gateway Status';

    if (!__IOS__) {
      Dialogs.alert({
        title,
        message,
        okButtonText: 'OK',
      });
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

    const sourceView = (anchor as any)?.ios as UIView | undefined;
    const alert = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      title,
      message,
      UIAlertControllerStyle.ActionSheet
    );
    if (onRetry) {
      const retryAction = UIAlertAction.actionWithTitleStyleHandler(
        'Retry',
        UIAlertActionStyle.Default,
        () => {
          onRetry();
        }
      );
      retryAction.setValueForKey(UIImage.systemImageNamed('arrow.clockwise'), 'image');
      alert.addAction(retryAction);
    }
    if (canActivate) {
      const activateAction = UIAlertAction.actionWithTitleStyleHandler(
        'Activate',
        UIAlertActionStyle.Default,
        () => {
          this.goToActivateService();
        }
      );
      activateAction.setValueForKey(UIImage.systemImageNamed('bolt.fill'), 'image');
      alert.addAction(activateAction);
    }

    const popover = alert.popoverPresentationController;
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

    viewController.presentViewControllerAnimatedCompletion(alert, true, null);

    if (autoDismissMs > 0) {
      setTimeout(() => {
        if (alert.presentingViewController && !alert.beingDismissed) {
          alert.dismissViewControllerAnimatedCompletion(true, null);
        }
      }, autoDismissMs);
    }
  }

  private syncTheme(): void {
    const appAppearance = Application.systemAppearance();
    this.isDarkTheme = appAppearance === 'dark';
  }
}
