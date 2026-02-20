import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { SubscriptionService } from '../shared/services/subscription.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  public isSubscribed = false;

  constructor(
    private subscriptionService: SubscriptionService,
    private routerExtensions: RouterExtensions,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isSubscribed = this.subscriptionService.getLocalStatus();
    this.subscriptionService.isSubscribed$.subscribe((isActive) => {
      this.isSubscribed = isActive;
      this.cdr.detectChanges();
    });
  }

  public openSubscription(): void {
    this.routerExtensions.navigate(['/subscription']);
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
}
