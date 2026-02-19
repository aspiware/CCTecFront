import { Injectable } from '@angular/core';
import { ApplicationSettings } from '@nativescript/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { UsersService } from './users.service';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionService {
  private readonly localKey = 'subscription.isActive';

  private readonly subscribedSubject = new BehaviorSubject<boolean>(this.getLocalStatus());
  public readonly isSubscribed$ = this.subscribedSubject.asObservable();

  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService,
    private usersService: UsersService
  ) {}

  public hasLocalStatus(): boolean {
    return ApplicationSettings.hasKey(this.localKey);
  }

  public getLocalStatus(): boolean {
    return ApplicationSettings.getBoolean(this.localKey, false);
  }

  public setLocalStatus(isActive: boolean): void {
    ApplicationSettings.setBoolean(this.localKey, isActive);
    this.subscribedSubject.next(isActive);
  }

  public verifyWithBackend(): Observable<boolean> {
    const userId = Number(this.usersService.getUser()?.userId || 0);
    if (!userId) {
      this.setLocalStatus(false);
      return of(false);
    }

    return this.httpClient
      .get<any>(`${this.configService.getUrlBase()}/subscriptions/verify/${userId}`)
      .pipe(
        map((res) => Boolean(res?.isActive)),
        tap((isActive) => this.setLocalStatus(isActive)),
        catchError(() => {
          this.setLocalStatus(false);
          return of(false);
        })
      );
  }

  public validateApplePurchase(payload: {
    receiptData: string;
    productId?: string;
    transactionId?: string;
    environment?: string;
  }): Observable<{ isActive: boolean; message?: string }> {
    const userId = Number(this.usersService.getUser()?.userId || 0);
    if (!userId || !payload?.receiptData) {
      this.setLocalStatus(false);
      return of({ isActive: false, message: 'Missing user or receipt data.' });
    }

    return this.httpClient
      .post<any>(`${this.configService.getUrlBase()}/subscriptions/apple/validate`, {
        userId,
        receiptData: payload.receiptData,
        productId: payload.productId,
        transactionId: payload.transactionId,
        environment: payload.environment,
      })
      .pipe(
        map((res) => {
          const isActive = Boolean(res?.isActive);
          const message = res?.message ? String(res.message) : undefined;
          console.log('[Subscription] validate response', JSON.stringify({ isActive, message }));
          return { isActive, message };
        }),
        tap((result) => this.setLocalStatus(result.isActive)),
        catchError(() => {
          this.setLocalStatus(false);
          return of({ isActive: false, message: 'Subscription validation request failed.' });
        })
      );
  }

  public activateTrial(): Observable<boolean> {
    // UI-first placeholder until purchase flow is connected.
    this.setLocalStatus(true);
    return of(true);
  }

  public deactivate(): void {
    this.setLocalStatus(false);
  }
}
