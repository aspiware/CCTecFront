import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getString } from '@nativescript/core/application-settings';
import {
  BehaviorSubject,
  catchError,
  concat,
  EMPTY,
  filter,
  finalize,
  Observable,
  of,
  shareReplay,
  Subject,
  tap,
  timeout,
} from 'rxjs';
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
  EzeeAddOrderEquipmentResponse,
  EzeeSwapOrderEquipmentResponse,
  EzeePreProvisionOrderResponse,
  EzeeOrderListItem,
  EzeeOrdersDay,
  EzeeOrdersResponse,
} from './ezee-order.model';

@Injectable({ providedIn: 'root' })
export class EzeeOrdersService {
  private readonly equipmentCache = new Map<string, EzeeOrderEquipmentResponse>();
  private readonly equipmentRequests = new Map<
    string,
    Observable<EzeeOrderEquipmentResponse>
  >();
  private readonly equipmentCacheVersions = new Map<string, number>();
  private equipmentCacheToken = '';
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

  public getOrderEquipment(
    number: string,
    forceRefresh = false
  ): Observable<EzeeOrderEquipmentResponse> {
    const token = getString('token', '');
    const cacheKey = number.trim();
    this.syncEquipmentCacheSession(token);

    if (forceRefresh) {
      this.invalidateOrderEquipment(cacheKey);
    }

    const cached = this.equipmentCache.get(cacheKey);
    const pendingRequest = this.equipmentRequests.get(cacheKey);
    if (pendingRequest) {
      return cached
        ? this.withCachedEquipment(cached, pendingRequest)
        : pendingRequest;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    const cacheVersion = this.equipmentCacheVersions.get(cacheKey) || 0;

    let request: Observable<EzeeOrderEquipmentResponse>;
    request = this.httpClient.get<EzeeOrderEquipmentResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/equipment/${encodeURIComponent(cacheKey)}`,
      { headers }
    ).pipe(
      timeout(20000),
      tap((response) => {
        if (
          !response?.error &&
          this.equipmentCacheToken === token &&
          (this.equipmentCacheVersions.get(cacheKey) || 0) === cacheVersion
        ) {
          this.equipmentCache.set(cacheKey, response);
        }
      }),
      finalize(() => {
        if (this.equipmentRequests.get(cacheKey) === request) {
          this.equipmentRequests.delete(cacheKey);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.equipmentRequests.set(cacheKey, request);
    return cached ? this.withCachedEquipment(cached, request) : request;
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
    ).pipe(
      timeout(20000),
      tap((response) => {
        if (!response?.error) {
          this.invalidateOrderEquipment(number);
        }
      })
    );
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
    ).pipe(
      timeout(20000),
      tap((response) => {
        if (!response?.error) {
          this.invalidateOrderEquipment(number);
        }
      })
    );
  }

  private invalidateOrderEquipment(number: string): void {
    const cacheKey = number.trim();
    const nextVersion = (this.equipmentCacheVersions.get(cacheKey) || 0) + 1;
    this.equipmentCache.delete(cacheKey);
    this.equipmentRequests.delete(cacheKey);
    this.equipmentCacheVersions.set(cacheKey, nextVersion);
  }

  private withCachedEquipment(
    cached: EzeeOrderEquipmentResponse,
    refresh: Observable<EzeeOrderEquipmentResponse>
  ): Observable<EzeeOrderEquipmentResponse> {
    return concat(
      of(cached),
      refresh.pipe(
        filter((response) => !response?.error && !this.hasSameEquipment(cached, response)),
        catchError(() => EMPTY)
      )
    );
  }

  private hasSameEquipment(
    current: EzeeOrderEquipmentResponse,
    incoming: EzeeOrderEquipmentResponse
  ): boolean {
    if (incoming?.error) {
      return false;
    }
    const equipmentValues = (response: EzeeOrderEquipmentResponse) =>
      (Array.isArray(response?.data?.equipment) ? response.data.equipment : []).map((item) => [
        item.id,
        item.serial,
        item.model,
        item.action,
      ]);
    return JSON.stringify(equipmentValues(current)) === JSON.stringify(equipmentValues(incoming));
  }

  private syncEquipmentCacheSession(token: string): void {
    if (this.equipmentCacheToken === token) {
      return;
    }
    this.equipmentCacheToken = token;
    this.equipmentCache.clear();
    this.equipmentRequests.clear();
    this.equipmentCacheVersions.clear();
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

    return this.httpClient.post<EzeeAddOrderNoteResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/orders/${encodeURIComponent(number)}/notes`,
      { comment },
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
