import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Dialogs } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from '../today/today.service';
import { finalize } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-devices',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.scss',
})
export class DevicesComponent {
  public job: any;
  public devices: any[] = [];
  private userId = 0;
  private actionTapStates: { [key: string]: boolean } = {};
  private actionTapTimers: { [key: string]: ReturnType<typeof setTimeout> } = {};
  private loadingStates: { [key: string]: boolean } = {};
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      {
        name: 'Save',
        icon: 'checkmark.circle',
        destructive: true,
        confirm: {
          title: 'Save note?',
          confirmText: 'Save',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      }
    ],
  };

  constructor(
    private modalParams: ModalDialogParams,
    private usersService: UsersService,
    private todayService: TodayService,
    private cdr: ChangeDetectorRef
  ) {
    const context = this.modalParams.context || {};
    this.job = context;
    this.devices = Array.isArray(this.job?.devices) ? this.job.devices : [];
    this.userId = Number(this.usersService.getUser()?.userId || 0);
  }

  get mainMenuOptions() {
    return this.mainMenu.options;
  }

  public closeWithoutSave(): void {
    this.modalParams.closeCallback();
  }

  public onSelectedMainMenu(event: MenuEvent, _menuStatus?: any): void {
    switch (event?.index) {
      case 0:
        // this.saveNote();
        break;
    }
  }

  public isModemType(item: any): boolean {
    const type = String(item?.type || '').toUpperCase();
    return type === 'MTA' || type === 'HSI' || type === 'CM';
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
    return !!this.loadingStates[this.getDeviceKey(item)];
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
          const message = String(
            res?.gatewayStatusFriendlyName ||
              res?.message ||
              res?.status ||
              res?.result ||
              'Gateway status checked.'
          );

          this.showGatewayStatusMessage(message, anchor);
        },
        error: (error) => {
          this.showGatewayStatusMessage(
            String(error?.error?.message || error?.message || 'Failed to check gateway status.'),
            anchor
          );
        },
      });
  }

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

  private showGatewayStatusMessage(message: string, anchor?: any): void {
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

    setTimeout(() => {
      if (alert.presentingViewController && !alert.beingDismissed) {
        alert.dismissViewControllerAnimatedCompletion(true, null);
      }
    }, 2000);
  }
}
