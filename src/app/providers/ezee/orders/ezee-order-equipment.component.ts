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

type EquipmentCodeField = 'serial' | 'mac' | 'equipmentId';

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
  public errorMessage = '';
  public isAddingEquipment = false;
  public newEquipment = {
    serial: '',
    mac: '',
    equipmentId: '',
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
    if (this.isAddingEquipment) {
      this.isAddingEquipment = false;
      this.cdr.detectChanges();
      return;
    }
    this.modalParams.closeCallback();
  }

  public openAddEquipment(): void {
    this.newEquipment = { serial: '', mac: '', equipmentId: '' };
    this.isAddingEquipment = true;
    this.cdr.detectChanges();
  }

  public scanField(field: EquipmentCodeField): void {
    const labels: Record<EquipmentCodeField, string> = {
      serial: 'Serial',
      mac: 'MAC address',
      equipmentId: 'Equipment ID',
    };
    const options: any = {
      context: { fieldLabel: labels[field] },
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
      this.newEquipment = { ...this.newEquipment, [field]: scannedValue };
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
    return !!this.newEquipment.serial.trim() &&
      !!this.newEquipment.mac.trim() &&
      !!this.newEquipment.equipmentId.trim();
  }

  public saveEquipment(): void {
    if (!this.canAddEquipment()) {
      return;
    }
    alert({
      title: 'Add Equipment',
      message: 'The equipment is ready. The save action will be connected when the endpoint is available.',
      okButtonText: 'OK',
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
