import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Dialogs } from '@nativescript/core';
import { QuantityStepperComponent } from '../../../shared/components/quantity-stepper/quantity-stepper.component';
import { Item } from '../../../shared/components/menu-button/item';
import { MenuEvent } from '../../../shared/components/menu-button';
import { EzeeOrderListItem, EzeePricingItem } from './ezee-order.model';
import { EzeeOrdersService } from './ezee-orders.service';

interface EditableCharge {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  standalone: true,
  selector: 'app-ezee-edit-order',
  imports: [NativeScriptCommonModule, QuantityStepperComponent],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-edit-order.component.html',
  styleUrl: '../../../edit-job/edit-job.component.scss',
})
export class EzeeEditOrderComponent implements OnInit {
  public readonly order: EzeeOrderListItem;
  public readonly charges: EditableCharge[];
  public isLoading = false;
  public isLoadingOptions = false;
  public optionsError = '';
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      {
        name: 'Save',
        icon: 'checkmark.circle',
        destructive: true,
        confirm: {
          title: 'Save order changes?',
          confirmText: 'Save',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      },
    ],
  };

  public constructor(
    private modalParams: ModalDialogParams,
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef
  ) {
    this.order = this.modalParams.context;
    this.charges = this.buildCharges(this.order?.pricing?.extras || []);
  }

  public ngOnInit(): void {
    this.loadChargeOptions();
  }

  public get totalPrice(): number {
    const baseTotal = Number(this.order?.pricing?.base?.total || 0);
    return this.charges.reduce((total, charge) => {
      return total + (Number(charge.quantity || 0) * Number(charge.unitPrice || 0));
    }, baseTotal);
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    if (event?.index === 0) {
      this.saveChanges();
    }
  }

  public updateQuantity(charge: EditableCharge, quantity: number): void {
    charge.quantity = Math.max(0, Math.floor(Number(quantity || 0)));
    this.cdr.detectChanges();
  }

  public closeModal(): void {
    if (!this.isLoading) {
      this.modalParams.closeCallback();
    }
  }

  private saveChanges(): void {
    if (this.isLoading || this.isLoadingOptions || !this.order?.number) {
      return;
    }

    const charges = this.charges
      .filter((charge) => charge.quantity > 0)
      .map((charge) => ({ code: charge.code, quantity: charge.quantity }));

    this.isLoading = true;
    this.cdr.detectChanges();
    this.ordersService.updateCharges(this.order.number, charges).subscribe({
      next: () => {
        this.isLoading = false;
        this.modalParams.closeCallback(true);
      },
      error: async (error) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        await Dialogs.alert({
          title: 'Edit Order',
          message: String(error?.error?.message || error?.message || 'Unable to save order charges.'),
          okButtonText: 'OK',
        });
      },
    });
  }

  private loadChargeOptions(): void {
    if (!this.order?.number) {
      return;
    }

    this.isLoadingOptions = true;
    this.optionsError = '';
    this.ordersService.getChargeOptions(this.order.number).subscribe({
      next: (response) => {
        this.mergeChargeOptions(this.extractChargeOptions(response));
        this.isLoadingOptions = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoadingOptions = false;
        this.optionsError = String(
          error?.error?.message || error?.message || 'Unable to load available charges.'
        );
        this.cdr.detectChanges();
      },
    });
  }

  private buildCharges(extras: EzeePricingItem[]): EditableCharge[] {
    return extras.reduce<EditableCharge[]>((charges, extra) => {
      const code = String(extra?.code || '').trim().toUpperCase();
      if (!code) {
        return charges;
      }
      charges.push({
        code,
        description: String(extra?.description || code),
        quantity: Math.max(0, Number(extra?.quantity || 0)),
        unitPrice: Number(extra?.unitPrice || 0),
      });
      return charges;
    }, []);
  }

  private extractChargeOptions(response: any): any[] {
    const candidates = [
      response,
      response?.data,
      response?.options,
      response?.chargeOptions,
      response?.data?.options,
      response?.data?.chargeOptions,
      response?.data?.charges,
    ];
    return candidates.find((candidate) => Array.isArray(candidate)) || [];
  }

  private mergeChargeOptions(options: any[]): void {
    const existingByCode = new Map(this.charges.map((charge) => [charge.code, charge]));

    options.forEach((option) => {
      const code = String(option?.code || '').trim().toUpperCase();
      if (!code) {
        return;
      }
      const existing = existingByCode.get(code);
      if (existing) {
        existing.description = String(option?.description || option?.name || existing.description || code);
        existing.unitPrice = Number(option?.unitPrice ?? option?.price ?? existing.unitPrice ?? 0);
        return;
      }

      const charge: EditableCharge = {
        code,
        description: String(option?.description || option?.name || code),
        quantity: Math.max(0, Number(option?.quantity || 0)),
        unitPrice: Number(option?.unitPrice ?? option?.price ?? 0),
      };
      this.charges.push(charge);
      existingByCode.set(code, charge);
    });

    this.charges.sort((left, right) => left.description.localeCompare(right.description));
  }
}
