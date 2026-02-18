import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { SubscriptionService } from '../shared/services/subscription.service';

@Component({
  standalone: true,
  selector: 'app-subscription',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss',
})
export class SubscriptionComponent implements OnInit {
  public isBusy = false;
  public message = '';

  private redirectTo = '/tabs';

  constructor(
    private subscriptionService: SubscriptionService,
    private routerExtensions: RouterExtensions,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.redirectTo = this.route.snapshot.queryParamMap.get('redirect') || '/tabs';
    const reason = this.route.snapshot.queryParamMap.get('reason');

    if (reason === 'inactive') {
      this.message = 'Your subscription is inactive. Subscribe to continue.';
    } else if (reason === 'verify-error') {
      this.message = 'Could not verify your subscription. Please try again.';
    } else {
      this.message = 'Start your 7-day trial to unlock full access.';
    }
  }

  public onSubscribe(): void {
    if (this.isBusy) {
      return;
    }

    this.isBusy = true;
    this.cdr.detectChanges();

    this.subscriptionService.activateTrial().subscribe({
      next: () => {
        this.isBusy = false;
        this.cdr.detectChanges();
        this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
      },
      error: () => {
        this.isBusy = false;
        this.message = 'Subscription failed. Try again.';
        this.cdr.detectChanges();
      },
    });
  }

  public onRestore(): void {
    if (this.isBusy) {
      return;
    }

    this.isBusy = true;
    this.cdr.detectChanges();

    this.subscriptionService.verifyWithBackend().subscribe({
      next: (isActive) => {
        this.isBusy = false;
        if (isActive) {
          this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
          return;
        }
        this.message = 'No active subscription found for this account.';
        this.cdr.detectChanges();
      },
      error: () => {
        this.isBusy = false;
        this.message = 'Restore failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }
}
