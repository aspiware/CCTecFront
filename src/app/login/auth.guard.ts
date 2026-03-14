import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { RouterExtensions } from '@nativescript/angular';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';
import { SettingsService } from '../settings/settings.service';
import { take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const router = inject(Router);
  const routerExtensions = inject(RouterExtensions);
  const configService = inject(ConfigService);
  const usersService = inject(UsersService);
  const settingsService = inject(SettingsService);
  const user = usersService.getUser();
  const userId = Number(user?.userId || 0);
  const isDemoUser = usersService.isDemoUser(user);
  const hasValidUser = Boolean(userId);
  const redirectToLogin = () =>
    router.createUrlTree(['/login'], {
      queryParams: { redirect: state.url || '/tabs' },
    });

  if (configService.isLoggedIn && hasValidUser) {
    if (isDemoUser) {
      return true;
    }

    // Allow immediate access from local auth cache, then enforce backend active flag.
    usersService.findById(userId).pipe(take(1)).subscribe({
      next: (res) => {
        console.log('[AuthGuard] findUserById response:', JSON.stringify(res));

        const activeFlag =
          res?.active ??
          res?.data?.active ??
          res?.user?.active ??
          res?.data?.user?.active;

        const isInactive =
          activeFlag === false ||
          activeFlag === 0 ||
          activeFlag === 'false' ||
          activeFlag === null ||
          activeFlag === undefined;

        if (isInactive) {
          configService.logout();
          routerExtensions.navigate(['/login'], {
            clearHistory: true,
            queryParams: { redirect: state.url || '/tabs' },
          });
        }
      },
      error: () => {
        // Keep current session on transient backend errors.
      },
    });

    return true;
  }

  return redirectToLogin();
};
