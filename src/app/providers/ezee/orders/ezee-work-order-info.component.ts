import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { finalize, Subscription } from 'rxjs';
import { EzeeOrderListItem, EzeeWorkOrderInfo } from './ezee-order.model';
import { EzeeOrdersService } from './ezee-orders.service';

interface WorkOrderInfoRow {
  label: string;
  value: string;
}

interface WorkOrderInfoGroup {
  title: string;
  rows: WorkOrderInfoRow[];
}

@Component({
  standalone: true,
  selector: 'app-ezee-work-order-info',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-work-order-info.component.html',
  styleUrl: './ezee-work-order-info.component.scss',
})
export class EzeeWorkOrderInfoComponent implements OnInit, OnDestroy {
  public readonly order: EzeeOrderListItem;
  public groups: WorkOrderInfoGroup[] = [];
  public isLoading = false;
  public errorMessage = '';
  private infoSubscription?: Subscription;

  public constructor(
    private modalParams: ModalDialogParams,
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef
  ) {
    this.order = this.modalParams.context?.order || ({} as EzeeOrderListItem);
  }

  public ngOnInit(): void {
    this.loadInfo();
  }

  public ngOnDestroy(): void {
    this.infoSubscription?.unsubscribe();
  }

  public close(): void {
    this.modalParams.closeCallback();
  }

  public retry(): void {
    this.loadInfo();
  }

  private loadInfo(): void {
    if (!this.order?.number || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    this.infoSubscription?.unsubscribe();
    this.infoSubscription = this.ordersService.getWorkOrderInfo(this.order.number).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          this.groups = [];
          this.errorMessage = response?.message || 'Unable to load work order information.';
          return;
        }
        this.groups = this.buildGroups(response?.data);
      },
      error: (error) => {
        this.groups = [];
        this.errorMessage = String(
          error?.error?.message || error?.message || 'Unable to load work order information.'
        );
      },
    });
  }

  private buildGroups(info: EzeeWorkOrderInfo | undefined): WorkOrderInfoGroup[] {
    return [
      {
        title: 'HOME',
        rows: [
          this.row('Residence type', info?.residenceType),
          this.row('Home status', info?.homeStatus),
          this.row('Activation date', info?.activationDate),
          this.row('Property type', info?.propertyType),
        ],
      },
      {
        title: 'CONNECTION',
        rows: [
          this.row('Aerial', info?.aerial),
          this.row('Wired', info?.wired),
          this.row('Drop connected', info?.dropConnected),
          this.row('Signal', info?.signal),
          this.row('Light levels', info?.lightLevels),
        ],
      },
      {
        title: 'NETWORK',
        rows: [
          this.row('Head end', info?.headEnd),
          this.row('Design area', info?.designArea),
          this.row('Hub', info?.hub),
          this.row('Map code', info?.mapCode),
          this.row('Node', info?.node),
          this.row('Segment', info?.segment),
          this.row('Tech region', info?.techRegion),
          this.row('Terminal', info?.terminal),
          this.row('Terminal type', info?.terminalType),
        ],
      },
    ];
  }

  private row(label: string, value: string | boolean | null | undefined): WorkOrderInfoRow {
    let displayValue = '—';
    if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else if (value !== null && value !== undefined && String(value).trim()) {
      displayValue = String(value).trim();
    }
    return { label, value: displayValue };
  }
}
