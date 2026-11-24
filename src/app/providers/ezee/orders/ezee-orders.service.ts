import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getString } from '@nativescript/core/application-settings';
import { BehaviorSubject, finalize, Observable, Subject, timeout } from 'rxjs';
import { ConfigService } from '../../../shared/services/config.service';
import {
  EzeeOrderGroup,
  EzeeOrderChargeUpdate,
  EzeeChargeOptionsResponse,
  EzeeAddOrderNoteResponse,
  EzeeFinalizeOrderResponse,
  EzeeFinalizeReason,
  EzeeOrderStatusResponse,
  EzeeOrderEquipmentResponse,
  EzeeOrderPackagesResponse,
  EzeeWorkOrderInfoResponse,
  EzeeOspTicketTemplateResponse,
  EzeeAddOrderEquipmentResponse,
  EzeeSwapOrderEquipmentResponse,
  EzeePreProvisionOrderResponse,
  EzeeOrderListItem,
  EzeeOrdersDay,
  EzeeOrdersResponse,
} from './ezee-order.model';

@Injectable({ providedIn: 'root' })
export class EzeeOrdersService {
  private readonly ordersSubject = new BehaviorSubject<EzeeOrderListItem[]>([]);
  private readonly summarySubject = new BehaviorSubject<EzeeOrdersDay>(this.emptySummary());
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new Subject<string>();

  public readonly orders$ = this.ordersSubject.asObservable();
  public readonly summary$ = this.summarySubject.asObservable();
  public readonly loading$ = this.loadingSubject.asObservable();
  public readonly error$ = this.errorSubject.asObservable();

  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) {}

  public getOrderEquipment(number: string): Observable<EzeeOrderEquipmentResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.get<EzeeOrderEquipmentResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/equipment/${encodeURIComponent(number)}`,
      { headers }
    ).pipe(timeout(20000));
  }

  public getOrderPackages(number: string): Observable<EzeeOrderPackagesResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.get<EzeeOrderPackagesResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/packages/${encodeURIComponent(number)}`,
      { headers }
    ).pipe(timeout(20000));
  }

  public getWorkOrderInfo(number: string): Observable<EzeeWorkOrderInfoResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.get<EzeeWorkOrderInfoResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/address/${encodeURIComponent(number)}`,
      { headers }
    ).pipe(timeout(20000));
  }

  public getOspTicketTemplate(number: string): Observable<EzeeOspTicketTemplateResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.get<EzeeOspTicketTemplateResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/osp-ticket-template/${encodeURIComponent(number)}`,
      { headers }
    ).pipe(timeout(20000));
  }

  public addOrderEquipment(
    number: string,
    id: string
  ): Observable<EzeeAddOrderEquipmentResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.httpClient.post<EzeeAddOrderEquipmentResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/equipment/add/${encodeURIComponent(number)}`,
      { id },
      { headers }
    ).pipe(timeout(20000));
  }

  public swapOrderEquipment(
    number: string,
    removeId: string,
    id: string
  ): Observable<EzeeSwapOrderEquipmentResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.httpClient.post<EzeeSwapOrderEquipmentResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/equipment/swap/${encodeURIComponent(number)}`,
      { removeId, id },
      { headers }
    ).pipe(timeout(20000));
  }

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
    const normalizedComment = String(comment || '').replace(/\r\n|\r|\n/g, '\r\n');
    console.log('[EzeeOrders] Sending note to backend:\n' + normalizedComment);

    return this.httpClient.post<EzeeAddOrderNoteResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/${encodeURIComponent(number)}/notes`,
      { comment: normalizedComment },
      { headers }
    ).pipe(timeout(20000));
  }

  public finalizeOrder(
    number: string,
    selectedReason: EzeeFinalizeReason
  ): Observable<EzeeFinalizeOrderResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.httpClient.post<EzeeFinalizeOrderResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/finalize/${encodeURIComponent(number)}`,
      {
        reason: selectedReason.reason,
        reasonId: selectedReason.reasonId,
      },
      { headers }
    ).pipe(timeout(20000));
  }

  public setEnroute(number: string): Observable<EzeeOrderStatusResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.post<EzeeOrderStatusResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/enroute/${encodeURIComponent(number)}`,
      {},
      { headers }
    ).pipe(timeout(20000));
  }

  public setInProgress(number: string): Observable<EzeeOrderStatusResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.post<EzeeOrderStatusResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/in-progress/${encodeURIComponent(number)}`,
      {},
      { headers }
    ).pipe(timeout(20000));
  }

  public preProvisionOrder(number: string): Observable<EzeePreProvisionOrderResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.post<EzeePreProvisionOrderResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/pre-provision/${encodeURIComponent(number)}`,
      {},
      { headers }
    ).pipe(timeout(20000));
  }

  public loadToday(onFinished?: (success: boolean) => void): void {
    if (this.loadingSubject.value) {
      console.log('[EzeeOrdersService] GET /ezee-fiber/orders skipped: request already in progress');
      onFinished?.(false);
      return;
    }

    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.loadingSubject.next(true);
    this.errorSubject.next('');
    console.log('[EzeeOrdersService] GET /ezee-fiber/orders request started');
    let succeeded = false;

    this.httpClient.get<EzeeOrdersResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders`,
      { headers }
    ).pipe(
      timeout(20000),
      finalize(() => {
        this.loadingSubject.next(false);
        onFinished?.(succeeded);
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
        succeeded = true;
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
