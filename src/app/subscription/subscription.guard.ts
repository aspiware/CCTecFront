import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { RouterExtensions } from '@nativescript/angular';
import { Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { SubscriptionService } from '../shared/services/subscription.service';

export const subscriptionGuard: CanActivateFn = (_route, state): boolean | Observable<boolean> => {
  const routerExtensions = inject(RouterExtensions);
  const subscriptionService = inject(SubscriptionService);
  const environment = { production: !!(globalThis as any).IS_PRODUCTION };
  const subscriptionBypass = !!(globalThis as any).SUBSCRIPTION_BYPASS;
  const enforceSubscription = !!(globalThis as any).ENFORCE_SUBSCRIPTION;
  const navigateToSubscription = (reason?: string) => {
    const queryParams: any = { redirect: state.url || '/tabs' };
    if (reason) {
      queryParams.reason = reason;
    }
    routerExtensions.navigate(['/subscription'], {
      clearHistory: true,
      queryParams,
    });
  };

  if (subscriptionBypass) {
    return true;
  }

  if (!environment.production && !enforceSubscription) {
    return true;
  }

  if (!subscriptionService.hasLocalStatus()) {
    return subscriptionService.verifyWithBackend().pipe(
      take(1),
      map((isActive) => {
        if (!isActive) {
          navigateToSubscription('inactive');
          return false;
        }
        return true;
      }),
      catchError(() => {
        navigateToSubscription('verify-error');
        return of(false);
      })
    );
  }

  if (!subscriptionService.getLocalStatus()) {
    navigateToSubscription('inactive');
    return false;
  }

  // Allow immediate access from cache, then enforce backend result.
  subscriptionService.verifyWithBackend().pipe(take(1)).subscribe({
    next: (isActive) => {
      if (!isActive) {
        routerExtensions.navigate(['/subscription'], {
          clearHistory: true,
          queryParams: { reason: 'inactive', redirect: state.url || '/tabs' },
        });
      }
    },
    error: () => {
      routerExtensions.navigate(['/subscription'], {
        clearHistory: true,
        queryParams: { reason: 'verify-error', redirect: state.url || '/tabs' },
      });
    },
  });

  return true;
};
