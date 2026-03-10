import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';

@Component({
  standalone: true,
  selector: 'app-devices',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.scss',
})
export class DevicesComponent {
  public devices: any[] = [];
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

  constructor(private modalParams: ModalDialogParams) {
    const context = this.modalParams.context || {};
    this.devices = Array.isArray(context?.devices) ? context.devices : [];
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

  public showRemoveDevicesModal(item: any): void {
    const key = this.getDeviceKey(item);
    if (!key || this.loadingStates[key]) {
      return;
    }

    this.loadingStates[key] = true;
    // Placeholder until modem status action is implemented.
    setTimeout(() => {
      this.loadingStates[key] = false;
    }, 900);
  }

  private getDeviceKey(item: any): string {
    return String(item?.id || item?.deviceId || item?.serialNumber || item?.deviceSerialNumber || '');
  }

  private getActionKey(item: any, action: string): string {
    return `${this.getDeviceKey(item)}:${action}`;
  }
}
