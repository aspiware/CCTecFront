import { Injectable } from '@angular/core';
import { ApplicationSettings } from '@nativescript/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionService {
  private readonly localKey = 'subscription.isActive';
  private readonly backendMockKey = 'subscription.backendIsActive';

  private readonly subscribedSubject = new BehaviorSubject<boolean>(this.getLocalStatus());
  public readonly isSubscribed$ = this.subscribedSubject.asObservable();

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

  public setBackendMockStatus(isActive: boolean): void {
    ApplicationSettings.setBoolean(this.backendMockKey, isActive);
  }

  public verifyWithBackend(): Observable<boolean> {
    const backendStatus = this.resolveBackendStatus();
    return of(backendStatus).pipe(
      delay(350),
      tap((isActive) => this.setLocalStatus(isActive))
    );
  }

  public activateTrial(): Observable<boolean> {
    this.setBackendMockStatus(true);
    return this.verifyWithBackend().pipe(map(() => true));
  }

  public deactivate(): void {
    this.setBackendMockStatus(false);
    this.setLocalStatus(false);
  }

  private resolveBackendStatus(): boolean {
    if (ApplicationSettings.hasKey(this.backendMockKey)) {
      return ApplicationSettings.getBoolean(this.backendMockKey, false);
    }

    // UI-first default: backend follows local until real API is connected.
    return this.getLocalStatus();
  }
}
