import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
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
  private appearanceChangedHandler?: () => void;

  constructor(
    private subscriptionService: SubscriptionService,
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
      console.log('SUB-DETAILS', details)
      const next = details?.nextPaymentDate;
      const expires = details?.expiresDate;

      if (details?.isActive && next) {
        this.subscriptionDateText = `Next payment: ${this.formatDate(next)}`;
      } else if (expires) {
        this.subscriptionDateText = `Expires: ${this.formatDate(expires)}`;
      } else {
        this.subscriptionDateText = 'Billing date unavailable';
      }
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
