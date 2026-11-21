import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { finalize, Subscription } from 'rxjs';
import {
  EzeeOrderListItem,
  EzeeOrderPackage,
  EzeeSuggestedEquipment,
} from './ezee-order.model';
import { EzeeOrdersService } from './ezee-orders.service';

@Component({
  standalone: true,
  selector: 'app-ezee-order-packages',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-order-packages.component.html',
  styleUrl: './ezee-order-packages.component.scss',
})
export class EzeeOrderPackagesComponent implements OnInit, OnDestroy {
  public readonly order: EzeeOrderListItem;
  public currentPackages: EzeeOrderPackage[] = [];
  public scheduledPackages: EzeeOrderPackage[] = [];
  public otherPackages: EzeeOrderPackage[] = [];
  public suggestedEquipment: EzeeSuggestedEquipment[] = [];
  public isLoading = false;
  public errorMessage = '';
  private packagesSubscription?: Subscription;

  public constructor(
    private modalParams: ModalDialogParams,
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef
  ) {
    this.order = this.modalParams.context?.order || ({} as EzeeOrderListItem);
  }

  public ngOnInit(): void {
    this.loadPackages();
  }

  public ngOnDestroy(): void {
    this.packagesSubscription?.unsubscribe();
  }

  public close(): void {
    this.modalParams.closeCallback();
  }

  public retry(): void {
    this.loadPackages();
  }

  public packageTitle(item: EzeeOrderPackage): string {
    return item.code ? `${item.code} - ${item.name}` : item.name;
  }

  private loadPackages(): void {
    if (!this.order?.number || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    this.packagesSubscription?.unsubscribe();
    this.packagesSubscription = this.ordersService.getOrderPackages(this.order.number).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          this.clearPackages();
          this.errorMessage = response?.message || 'Unable to load the customer package.';
          return;
        }
        this.currentPackages = this.asPackageList(response?.data?.currentPackages);
        this.scheduledPackages = this.asPackageList(response?.data?.scheduledPackages);
        this.otherPackages = this.asPackageList(response?.data?.otherPackages);
        this.suggestedEquipment = this.asSuggestedEquipmentList(
          response?.data?.suggestedEquipment
        );
      },
      error: (error) => {
        this.clearPackages();
        this.errorMessage = String(
          error?.error?.message || error?.message || 'Unable to load the customer package.'
        );
      },
    });
  }

  private asPackageList(value: unknown): EzeeOrderPackage[] {
    return Array.isArray(value) ? value : [];
  }

  private asSuggestedEquipmentList(value: unknown): EzeeSuggestedEquipment[] {
    return Array.isArray(value) ? value : [];
  }

  private clearPackages(): void {
    this.currentPackages = [];
    this.scheduledPackages = [];
    this.otherPackages = [];
    this.suggestedEquipment = [];
  }
}
