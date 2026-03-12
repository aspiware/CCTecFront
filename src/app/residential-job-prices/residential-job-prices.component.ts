import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';

@Component({
  standalone: true,
  selector: 'app-residential-job-prices',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './residential-job-prices.component.html',
  styleUrl: './residential-job-prices.component.scss',
})
export class ResidentialJobPricesComponent {
  public isSaveLoading = false;
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
    // Placeholder refresh flow until backend wiring is added.
    console.log('[ResidentialJobPrices] refresh');
  }
}
