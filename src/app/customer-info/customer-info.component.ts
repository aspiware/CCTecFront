import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';

@Component({
  standalone: true,
  selector: 'app-customer-info',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './customer-info.component.html',
  styleUrl: './customer-info.component.scss',
})
export class CustomerInfoComponent {
  job: any;
  mainMenu: Item =
    {
      name: 'Main Menu',
      options: [
        { name: 'Refresh Wi-Fi Info', icon: 'arrow.clockwise' },
        { name: 'Connect to Wi-Fi', icon: 'wifi' },
        { name: 'Share Wi-Fi via SMS', icon: 'ellipsis.message' },
        {
          name: 'Save Wi-Fi Settings', icon: 'checkmark.circle', destructive: true, confirm: {
            title: 'Do you want to save the new Wi-Fi settings?',
            confirmText: 'Yes',
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };

  constructor(private modalParams: ModalDialogParams) {
    this.job = this.modalParams.context;
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    console.log('[CustomerInfo] menu selected', event?.index);
  }

  public closeModal(): void {
    this.modalParams.closeCallback();
  }
}
