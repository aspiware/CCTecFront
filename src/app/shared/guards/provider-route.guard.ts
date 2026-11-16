import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProviderId, ProviderService } from '../services/provider.service';

const providerRouteGuard = (expectedProvider: ProviderId): CanActivateFn => () => {
  const providerService = inject(ProviderService);
  const router = inject(Router);

  if (providerService.provider === expectedProvider) {
    return true;
  }

  return router.parseUrl(providerService.getHomeRoute());
};

export const xfinityProviderGuard = providerRouteGuard('xfinity');
export const ezeeProviderGuard = providerRouteGuard('ezee-fiber');
