import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Subscription } from 'rxjs';
import { EzeeOrdersService } from './ezee-orders.service';
import { EzeeOrderListItem } from './ezee-order.model';

@Component({
  standalone: true,
  selector: 'app-ezee-orders',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-orders.component.html',
  styleUrl: './ezee-orders.component.scss',
})
export class EzeeOrdersComponent implements OnInit, OnDestroy {
  public orders: EzeeOrderListItem[] = [];
  public isLoading = false;
  public errorMessage = '';
  public reportDate = '';
  public pendingCount = 0;
  public completedCount = 0;
  private readonly subscriptions = new Subscription();

  constructor(
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.subscriptions.add(this.ordersService.orders$.subscribe((orders) => {
      this.orders = orders;
      this.cdr.detectChanges();
    }));
    this.subscriptions.add(this.ordersService.loading$.subscribe((isLoading) => {
      this.isLoading = isLoading;
      this.cdr.detectChanges();
    }));
    this.subscriptions.add(this.ordersService.summary$.subscribe((summary) => {
      this.reportDate = summary.date;
      this.pendingCount = summary.pending.count;
      this.completedCount = summary.completed.count;
      this.cdr.detectChanges();
    }));
    this.subscriptions.add(this.ordersService.error$.subscribe((message) => {
      this.errorMessage = message;
      this.cdr.detectChanges();
    }));
    this.ordersService.loadToday();
  }

  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  public refresh(): void {
    this.ordersService.loadToday();
  }

  public orderTitle(order: EzeeOrderListItem): string {
    return `Order #${order.number}`;
  }
}
