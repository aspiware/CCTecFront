import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { Dialogs, Page } from '@nativescript/core';
import { SettingsComponent } from '../../../settings/settings.component';
import { SettingsService } from '../../../settings/settings.service';
import { ConfigService } from '../../../shared/services/config.service';
import { SubscriptionService } from '../../../shared/services/subscription.service';
import { TodayJobsCountService } from '../../../shared/services/today-jobs-count.service';
import { UsersService } from '../../../shared/services/users.service';
import { VersionService } from '../../../shared/services/version.service';

@Component({
  standalone: true,
  selector: 'app-ezee-settings',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: '../../../settings/settings.component.html',
  styleUrl: '../../../settings/settings.component.scss',
})
export class EzeeSettingsComponent extends SettingsComponent {
  public override isEzeeSettings = true;

  constructor(
    subscriptionService: SubscriptionService,
    configService: ConfigService,
    settingsService: SettingsService,
    todayJobsCountService: TodayJobsCountService,
    usersService: UsersService,
    versionService: VersionService,
    router: Router,
    routerExtensions: RouterExtensions,
    cdr: ChangeDetectorRef,
    page: Page
  ) {
    super(
      subscriptionService,
      configService,
      settingsService,
      todayJobsCountService,
      usersService,
      versionService,
      router,
      routerExtensions,
      cdr,
      page
    );
  }

  public override openResidentialJobPrices(): void {
    this.showPendingFeature('Pay Rate');
  }

  public override openXhJobPrices(): void {
    this.showPendingFeature('XH Prices');
  }

  public override openFiberJobPrices(): void {
    this.showPendingFeature('Fiber Prices');
  }

  public override openBusinessJobPrices(): void {
    this.showPendingFeature('Business Prices');
  }

  public override openPayroll(): void {
    this.showPendingFeature('Payroll');
  }

  public override openSmsSurvey(): void {
    this.showPendingFeature('SMS Survey');
  }

  public override openSmsAvailability(): void {
    this.showPendingFeature('SMS Availability');
  }

  public override openXmUpdateToken(): void {
    this.showPendingFeature('Update Token');
  }

  public override async confirmDeleteAccount(): Promise<void> {
    await this.showPendingFeature('Delete Account');
  }

  private async showPendingFeature(feature: string): Promise<void> {
    await Dialogs.alert({
      title: feature,
      message: `${feature} is not connected for Ezee Fiber yet.`,
      okButtonText: 'OK',
    });
  }
}
