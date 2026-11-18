import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { finalize, Subscription } from 'rxjs';
import { EzeeOrderEquipment, EzeeOrderListItem } from './ezee-order.model';
import { EzeeOrdersService } from './ezee-orders.service';

@Component({
  standalone: true,
  selector: 'app-ezee-order-equipment',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-order-equipment.component.html',
  styleUrl: './ezee-order-equipment.component.scss',
})
export class EzeeOrderEquipmentComponent implements OnInit, OnDestroy {
  public order: EzeeOrderListItem;
  public equipment: EzeeOrderEquipment[] = [];
  public isLoading = false;
  public errorMessage = '';
  private equipmentSubscription?: Subscription;

  public constructor(
    private modalParams: ModalDialogParams,
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef
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
    this.modalParams.closeCallback();
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
