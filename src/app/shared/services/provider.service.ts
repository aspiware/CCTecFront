import { Injectable } from '@angular/core';
import { getString, setString } from '@nativescript/core/application-settings';
import { BehaviorSubject } from 'rxjs';

export type ProviderId = 'xfinity' | 'ezee-fiber';

@Injectable({ providedIn: 'root' })
export class ProviderService {
  private readonly storageKey = 'provider';
  private readonly providerSubject = new BehaviorSubject<ProviderId>(this.readStoredProvider());

  public readonly provider$ = this.providerSubject.asObservable();

  public get provider(): ProviderId {
    return this.providerSubject.value;
  }

  public setProvider(provider: ProviderId): void {
    setString(this.storageKey, provider);
    this.providerSubject.next(provider);
  }

  public isXfinity(): boolean {
    return this.provider === 'xfinity';
  }

  public isEzeeFiber(): boolean {
    return this.provider === 'ezee-fiber';
  }

  public getHomeRoute(): string {
    return this.isEzeeFiber() ? '/ezee-tabs' : '/tabs';
  }

  private readStoredProvider(): ProviderId {
    return getString(this.storageKey, 'xfinity') === 'ezee-fiber'
      ? 'ezee-fiber'
      : 'xfinity';
  }
}
