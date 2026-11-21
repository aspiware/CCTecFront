import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ViewContainerRef } from '@angular/core';
import {
  ModalDialogParams,
  ModalDialogService,
  NativeScriptCommonModule,
  NativeScriptFormsModule,
} from '@nativescript/angular';
import { alert } from '@nativescript/core';
import { finalize, Subscription } from 'rxjs';
import { EzeeOrderEquipment, EzeeOrderListItem } from './ezee-order.model';
import { EzeeOrdersService } from './ezee-orders.service';
import { EzeeEquipmentScannerComponent } from './ezee-equipment-scanner.component';

@Component({
  standalone: true,
  selector: 'app-ezee-order-equipment',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-order-equipment.component.html',
  styleUrl: './ezee-order-equipment.component.scss',
})
export class EzeeOrderEquipmentComponent implements OnInit, OnDestroy {
  public order: EzeeOrderListItem;
  public equipment: EzeeOrderEquipment[] = [];
  public isLoading = false;
  public isSavingEquipment = false;
  public errorMessage = '';
  public isAddingEquipment = false;
  public swappingEquipment: EzeeOrderEquipment | null = null;
  public newEquipment = {
    serial: '',
  };
  public replacementEquipment = {
    id: '',
  };
  private equipmentSubscription?: Subscription;

  public constructor(
    private modalParams: ModalDialogParams,
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef
  ) {
    this.order = this.modalParams.context?.order || ({} as EzeeOrderListItem);
  }

  public ngOnInit(): void {
    this.loadEquipment();
  }

  public ngOnDestroy(): void {
    this.equipmentSubscription?.unsubscribe();
  }

  public close(): void {
    if (this.isSavingEquipment) {
      return;
    }
    if (this.isAddingEquipment || this.swappingEquipment) {
      this.isAddingEquipment = false;
      this.swappingEquipment = null;
      this.cdr.detectChanges();
      return;
    }
    this.modalParams.closeCallback();
  }

  public openAddEquipment(): void {
    this.newEquipment = { serial: '' };
    this.swappingEquipment = null;
    this.isAddingEquipment = true;
    this.cdr.detectChanges();
  }

  public openSwapEquipment(equipment: EzeeOrderEquipment): void {
    this.replacementEquipment = { id: '' };
    this.isAddingEquipment = false;
    this.swappingEquipment = equipment;
    this.cdr.detectChanges();
  }

  public scanSerial(): void {
    this.openScanner('Equipment ID', (scannedValue) => {
      this.newEquipment = { serial: scannedValue };
    });
  }

  public scanReplacementId(): void {
    this.openScanner('Replacement equipment ID', (scannedValue) => {
      this.replacementEquipment = { id: scannedValue };
    });
  }

  private openScanner(fieldLabel: string, onScanned: (value: string) => void): void {
    const options: any = {
      context: { fieldLabel },
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: true,
      stretched: true,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.FullScreen,
      },
    };

    this.modalService.showModal(EzeeEquipmentScannerComponent, options).then((result) => {
      const scannedValue = typeof result === 'string' ? result.trim() : '';
      if (!scannedValue) {
        return;
      }
      onScanned(scannedValue);
      this.cdr.detectChanges();
    }).catch((error) => {
      console.log('[EzeeEquipment] Failed to open scanner', error);
      alert({
        title: 'Scan Equipment',
        message: 'Unable to open the equipment scanner.',
        okButtonText: 'OK',
      });
    });
  }

  public canAddEquipment(): boolean {
    return !!this.newEquipment.serial.trim();
  }

  public canSwapEquipment(): boolean {
    const oldId = this.swappingEquipment?.id?.trim() || '';
    const newId = this.replacementEquipment.id.trim();
    return !!oldId && !!newId && oldId !== newId;
  }

  public saveEquipment(): void {
    if (!this.canAddEquipment() || this.isSavingEquipment) {
      return;
    }

    const serial = this.newEquipment.serial.trim();
    this.isSavingEquipment = true;
    this.cdr.detectChanges();
    this.ordersService.addOrderEquipment(this.order.number, serial).pipe(
      finalize(() => {
        this.isSavingEquipment = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          alert({
            title: 'Add Equipment',
            message: response?.message || 'Unable to add the equipment.',
            okButtonText: 'OK',
          });
          return;
        }

        alert({
          title: 'Equipment Added',
          message: response?.message || 'Equipment added successfully.',
          okButtonText: 'OK',
        });
        this.newEquipment = { serial: '' };
        this.isAddingEquipment = false;
        this.loadEquipment();
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to add the equipment.'
        );
        alert({ title: 'Add Equipment', message, okButtonText: 'OK' });
      },
    });
  }

  public saveSwap(): void {
    if (!this.canSwapEquipment() || this.isSavingEquipment || !this.swappingEquipment) {
      return;
    }

    const oldId = this.swappingEquipment.id.trim();
    const newId = this.replacementEquipment.id.trim();
    this.isSavingEquipment = true;
    this.cdr.detectChanges();
    this.ordersService.swapOrderEquipment(this.order.number, oldId, newId).pipe(
      finalize(() => {
        this.isSavingEquipment = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          alert({
            title: 'Swap Equipment',
            message: response?.message || 'Unable to swap the equipment.',
            okButtonText: 'OK',
          });
          return;
        }

        alert({
          title: 'Equipment Swapped',
          message: response?.message || 'Equipment swapped successfully.',
          okButtonText: 'OK',
        });
        this.replacementEquipment = { id: '' };
        this.swappingEquipment = null;
        this.loadEquipment();
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to swap the equipment.'
        );
        alert({ title: 'Swap Equipment', message, okButtonText: 'OK' });
      },
    });
  }

  public retry(): void {
    this.loadEquipment();
  }

  private loadEquipment(): void {
    if (!this.order?.number || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    this.equipmentSubscription?.unsubscribe();
    this.equipmentSubscription = this.ordersService.getOrderEquipment(this.order.number).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          this.equipment = [];
          this.errorMessage = response?.message || 'Unable to load the order equipment.';
          return;
        }
        this.equipment = Array.isArray(response?.data?.equipment)
          ? response.data.equipment
          : [];
      },
      error: (error) => {
        this.equipment = [];
        this.errorMessage = String(
          error?.error?.message || error?.message || 'Unable to load the order equipment.'
        );
      },
    });
  }
}
