import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Application, Utils } from '@nativescript/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface AppVersionStatus {
  localVersion: string;
  storeVersion: string;
  isUpdateAvailable: boolean;
  appStoreUrl: string;
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly forceUpdateTest = false;

  constructor(private httpClient: HttpClient) {}

  public getLocalVersion(): string {
    if (__IOS__) {
      const info = NSBundle.mainBundle.infoDictionary;
      return String(info?.objectForKey('CFBundleShortVersionString') || '').trim();
    }

    if (__ANDROID__) {
      try {
        const context = Application.android?.context;
        const packageName = context?.getPackageName?.();
        const packageManager = context?.getPackageManager?.();
        const packageInfo = packageManager?.getPackageInfo?.(packageName, 0) as any;
        return String(packageInfo?.versionName || '').trim();
      } catch {
        return '';
      }
    }

    return '';
  }

  public checkAppStoreVersion(country = 'us'): Observable<AppVersionStatus> {
    if (this.forceUpdateTest) {
      const localVersion = this.getLocalVersion();
      return of({
        localVersion,
        storeVersion: '9.9.9',
        isUpdateAvailable: true,
        appStoreUrl: 'https://apps.apple.com/us/genre/ios/id36',
      });
    }

    if (!__IOS__) {
      return of({
        localVersion: this.getLocalVersion(),
        storeVersion: '',
        isUpdateAvailable: false,
        appStoreUrl: '',
      });
    }

    const bundleId = String(NSBundle.mainBundle.bundleIdentifier || '').trim();
    const localVersion = this.getLocalVersion();
    if (!bundleId) {
      return of({
        localVersion,
        storeVersion: '',
        isUpdateAvailable: false,
        appStoreUrl: '',
      });
    }

    const params = new HttpParams()
      .set('bundleId', bundleId)
      .set('country', country);

    return this.httpClient.get<any>('https://itunes.apple.com/lookup', { params }).pipe(
      map((res: any) => {
        const result = Array.isArray(res?.results) ? res.results[0] : null;
        const storeVersion = String(result?.version || '').trim();
        const appStoreUrl = String(result?.trackViewUrl || '').trim();
        return {
          localVersion,
          storeVersion,
          isUpdateAvailable: this.compareVersions(storeVersion, localVersion) > 0,
          appStoreUrl,
        };
      }),
      catchError(() =>
        of({
          localVersion,
          storeVersion: '',
          isUpdateAvailable: false,
          appStoreUrl: '',
        })
      )
    );
  }

  public openAppStore(url: string): void {
    if (!url) {
      return;
    }
    Utils.openUrl(url);
  }

  private compareVersions(left: string, right: string): number {
    const leftParts = this.normalizeVersion(left);
    const rightParts = this.normalizeVersion(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let i = 0; i < maxLength; i += 1) {
      const leftValue = leftParts[i] ?? 0;
      const rightValue = rightParts[i] ?? 0;
      if (leftValue > rightValue) {
        return 1;
      }
      if (leftValue < rightValue) {
        return -1;
      }
    }

    return 0;
  }

  private normalizeVersion(value: string): number[] {
    return String(value || '')
      .split('.')
      .map((part) => Number(String(part).replace(/[^\d]/g, '')))
      .filter((part) => !Number.isNaN(part));
  }
}
