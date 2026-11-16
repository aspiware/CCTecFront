import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getString } from '@nativescript/core/application-settings';
import { BehaviorSubject, finalize, timeout } from 'rxjs';
import { ConfigService } from '../../../shared/services/config.service';
import {
  EzeeOrderGroup,
  EzeeOrderListItem,
  EzeeOrdersDay,
  EzeeOrdersResponse,
} from './ezee-order.model';

@Injectable({ providedIn: 'root' })
export class EzeeOrdersService {
  private readonly ordersSubject = new BehaviorSubject<EzeeOrderListItem[]>([]);
  private readonly summarySubject = new BehaviorSubject<EzeeOrdersDay>(this.emptySummary());
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string>('');

  public readonly orders$ = this.ordersSubject.asObservable();
  public readonly summary$ = this.summarySubject.asObservable();
  public readonly loading$ = this.loadingSubject.asObservable();
  public readonly error$ = this.errorSubject.asObservable();

  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) {}

  public loadToday(): void {
    if (this.loadingSubject.value) {
      return;
    }

    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.loadingSubject.next(true);
    this.errorSubject.next('');

    this.httpClient.get<EzeeOrdersResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders`,
      { headers }
    ).pipe(
      timeout(20000),
      finalize(() => this.loadingSubject.next(false))
    ).subscribe({
      next: (response) => {
        const summary = this.normalizeResponse(response);
        this.summarySubject.next(summary);
        this.ordersSubject.next([
          ...summary.pending.orders.map((order) => ({ ...order, workflowStatus: 'Pending' as const })),
          ...summary.completed.orders.map((order) => ({ ...order, workflowStatus: 'Completed' as const })),
        ]);
      },
      error: (error) => {
        this.ordersSubject.next([]);
        this.summarySubject.next(this.emptySummary());
        this.errorSubject.next(
          String(error?.error?.message || error?.message || 'Unable to load today\'s orders.')
        );
      },
    });
  }

  private normalizeResponse(response: EzeeOrdersResponse): EzeeOrdersDay {
    const data = response?.data;
    const pendingOrders = Array.isArray(data?.pending?.orders) ? data.pending.orders : [];
    const completedOrders = Array.isArray(data?.completed?.orders) ? data.completed.orders : [];

    return {
      date: String(data?.date || ''),
      pending: this.normalizeGroup(data?.pending, pendingOrders),
      completed: this.normalizeGroup(data?.completed, completedOrders),
    };
  }

  private normalizeGroup(group: EzeeOrderGroup | undefined, orders: EzeeOrderGroup['orders']): EzeeOrderGroup {
    return {
      count: Number.isFinite(Number(group?.count)) ? Number(group?.count) : orders.length,
      orders,
    };
  }

  private emptySummary(): EzeeOrdersDay {
    return {
      date: '',
      pending: { count: 0, orders: [] },
      completed: { count: 0, orders: [] },
    };
  }
}
