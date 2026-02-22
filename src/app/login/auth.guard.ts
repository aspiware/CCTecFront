import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { ConfigService } from '../shared/services/config.service';

export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const router = inject(Router);
  const configService = inject(ConfigService);

  if (configService.isLoggedIn) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url || '/tabs' },
  });
};

