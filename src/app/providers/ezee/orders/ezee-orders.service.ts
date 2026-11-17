import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getString } from '@nativescript/core/application-settings';
import { BehaviorSubject, finalize, Observable, timeout } from 'rxjs';
import { ConfigService } from '../../../shared/services/config.service';
import {
  EzeeOrderGroup,
  EzeeOrderChargeUpdate,
  EzeeChargeOptionsResponse,
  EzeeAddOrderNoteResponse,
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

  public getChargeOptions(number: string): Observable<EzeeChargeOptionsResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.get<EzeeChargeOptionsResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/${encodeURIComponent(number)}/charge-options`,
      { headers }
    ).pipe(timeout(20000));
  }

  public updateCharges(number: string, charges: EzeeOrderChargeUpdate[]): Observable<any> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.patch<any>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/${encodeURIComponent(number)}/charges`,
      { charges },
      { headers }
    ).pipe(timeout(20000));
  }

  public addNote(number: string, comment: string): Observable<EzeeAddOrderNoteResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.httpClient.post<EzeeAddOrderNoteResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/${encodeURIComponent(number)}/notes`,
      { comment },
      { headers }
    ).pipe(timeout(20000));
  }

  public loadToday(onFinished?: () => void): void {
    if (this.loadingSubject.value) {
      console.log('[EzeeOrdersService] GET /ezee-fiber/orders skipped: request already in progress');
      onFinished?.();
      return;
    }

    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.loadingSubject.next(true);
    this.errorSubject.next('');
    console.log('[EzeeOrdersService] GET /ezee-fiber/orders request started');

    this.httpClient.get<EzeeOrdersResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders`,
      { headers }
    ).pipe(
      timeout(20000),
      finalize(() => {
        this.loadingSubject.next(false);
        onFinished?.();
      })
    ).subscribe({
      next: (response) => {
        console.log(
          `[EzeeOrdersService] GET /ezee-fiber/orders response:\n${JSON.stringify(response, null, 2)}`
        );
        if (response?.error) {
          this.ordersSubject.next([]);
          this.summarySubject.next(this.emptySummary());
          this.errorSubject.next(response?.message || 'Unable to load today\'s orders.');
          return;
        }
        const summary = this.normalizeResponse(response);
        this.summarySubject.next(summary);
        this.ordersSubject.next([
          ...summary.pending.orders.map((order) => ({ ...order, workflowStatus: 'Pending' as const })),
          ...summary.completed.orders.map((order) => ({ ...order, workflowStatus: 'Completed' as const })),
        ]);
      },
      error: (error) => {
        console.log(
          `[EzeeOrdersService] GET /ezee-fiber/orders error:\n${JSON.stringify(error, null, 2)}`
        );
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
