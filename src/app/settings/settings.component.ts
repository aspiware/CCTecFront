import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { Application, Page, Utils } from '@nativescript/core';
import { SubscriptionService } from '../shared/services/subscription.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit, OnDestroy {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSubscribed = false;
  public subscriptionDateText = 'Billing date unavailable';
  public subscriptionPlanText = 'Plan: -';
  public subscriptionPriceIntervalText = '-';
  public subscriptionAutoRenewText = 'Auto-renew: -';
  public subscriptionCanceledAtText = 'Canceled at: -';
  private appearanceChangedHandler?: () => void;

  constructor(
    private subscriptionService: SubscriptionService,
    private router: Router,
    private routerExtensions: RouterExtensions,
    private cdr: ChangeDetectorRef,
    private page: Page
  ) {}

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);

    this.isSubscribed = this.subscriptionService.getLocalStatus();
    this.subscriptionService.isSubscribed$.subscribe((isActive) => {
      this.isSubscribed = isActive;
      this.cdr.detectChanges();
    });
    this.loadSubscriptionDetails();
  }

  ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public openSubscription(): void {
    this.routerExtensions.navigate(['/subscription']);
  }

  public onManageSubscription(): void {
    if (__IOS__) {
      Utils.openUrl('itms-apps://apps.apple.com/account/subscriptions');
      return;
    }
    this.openSubscription();
  }

  public openResidentialJobPrices(): void {
    this.router.navigate(['/tabs', { outlets: { settingsTab: ['residential-job-prices'] } }]);
  }

  public openXhJobPrices(): void {
    this.router.navigate(['/tabs', { outlets: { settingsTab: ['xh-job-prices'] } }]);
  }

  public openFiberJobPrices(): void {
    this.router.navigate(['/tabs', { outlets: { settingsTab: ['fiber-job-prices'] } }]);
  }

  public openBusinessJobPrices(): void {
    this.router.navigate(['/tabs', { outlets: { settingsTab: ['business-job-prices'] } }]);
  }

  public openXmUpdateToken(): void {
    this.router.navigate(['/tabs', { outlets: { settingsTab: ['xm-update-token'] } }]);
  }

  public simulateActive(): void {
    this.subscriptionService.setLocalStatus(true);
  }

  public simulateInactive(): void {
    this.subscriptionService.setLocalStatus(false);
    this.routerExtensions.navigate(['/subscription'], {
      clearHistory: true,
      queryParams: { reason: 'inactive' },
    });
  }

  private syncTheme(): void {
    const appAppearance = Application.systemAppearance();
    if (appAppearance === 'dark' || appAppearance === 'light') {
      this.isDarkTheme = appAppearance === 'dark';
      return;
    }

    const pageClassName = String(this.page.className || '');
    this.isDarkTheme = pageClassName.includes('ns-dark');
  }

  private loadSubscriptionDetails(): void {
    this.subscriptionService.getSubscriptionDetails().subscribe((details) => {
      const next = details?.nextPaymentDate;
      const expires = details?.expiresDate;

      if (details?.isActive && next) {
        this.subscriptionDateText = `Next payment: ${this.formatDate(next)}`;
      } else if (expires) {
        this.subscriptionDateText = `Expires: ${this.formatDate(expires)}`;
      } else {
        this.subscriptionDateText = 'Billing date unavailable';
      }

      const planText = details?.planName || '-';
      this.subscriptionPlanText = `Plan: ${planText}`;
      if (details?.amount !== undefined && details?.amount !== null && !Number.isNaN(details.amount)) {
        const amountText = details.amount.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const intervalText = details?.interval ? ` / ${details.interval}` : '';
        this.subscriptionPriceIntervalText = `$${amountText}${intervalText}`;
      } else {
        this.subscriptionPriceIntervalText = details?.interval ? String(details.interval) : '-';
      }

      let autoRenewLabel = '-';
      if (details?.autoRenewStatus === true) {
        autoRenewLabel = 'On';
      } else if (details?.autoRenewStatus === false) {
        autoRenewLabel = 'Off';
      }
      this.subscriptionAutoRenewText = `Auto-renew: ${autoRenewLabel}`;
      this.subscriptionCanceledAtText = details?.canceledAt
        ? `Canceled at: ${this.formatDate(details.canceledAt)}`
        : 'Canceled at: -';

      this.cdr.detectChanges();
    });
  }

  private formatDate(value: Date): string {
    return value.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
