import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { RouterExtensions } from '@nativescript/angular';
import { Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { SubscriptionService } from '../shared/services/subscription.service';

export const subscriptionGuard: CanActivateFn = (_route, state): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const routerExtensions = inject(RouterExtensions);
  const subscriptionService = inject(SubscriptionService);
  const environment = { production: !!(globalThis as any).IS_PRODUCTION };
  const subscriptionBypass = !!(globalThis as any).SUBSCRIPTION_BYPASS;
  const enforceSubscription = !!(globalThis as any).ENFORCE_SUBSCRIPTION;

  if (subscriptionBypass) {
    return true;
  }

  if (!environment.production && !enforceSubscription) {
    return true;
  }

  const redirectTree = router.createUrlTree(['/subscription'], {
    queryParams: { redirect: state.url || '/tabs' },
  });

  if (!subscriptionService.hasLocalStatus()) {
    return subscriptionService.verifyWithBackend().pipe(
      take(1),
      map((isActive) => (isActive ? true : redirectTree)),
      catchError(() => of(redirectTree))
    );
  }

  if (!subscriptionService.getLocalStatus()) {
    return redirectTree;
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
