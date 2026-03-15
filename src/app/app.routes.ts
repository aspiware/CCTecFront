import { Routes } from '@angular/router';
import { TabsContainerComponent } from './tabs/tabs-container.component';
import { SummaryComponent } from './summary/summary.component';
import { JobsComponent } from './jobs/jobs.component';
import { TodayComponent } from './today/today.component';
import { SettingsComponent } from './settings/settings.component';
import { CustomerConsentComponent } from './customer-consent/customer-consent.component';
import { SubscriptionComponent } from './subscription/subscription.component';
import { subscriptionGuard } from './subscription/subscription.guard';
import { LoginComponent } from './login/login.component';
import { authGuard } from './login/auth.guard';
import { ActivateServiceComponent } from './activate-service/activate-service.component';
import { ResidentialJobPricesComponent } from './residential-job-prices/residential-job-prices.component';
import { XhJobPricesComponent } from './xh-job-prices/xh-job-prices.component';
import { FiberJobPricesComponent } from './fiber-job-prices/fiber-job-prices.component';
import { BusinessJobPricesComponent } from './business-job-prices/business-job-prices.component';
import { PayrollComponent } from './payroll/payroll.component';
import { XmUpdateTokenComponent } from './xm-update-token/xm-update-token.component';
import { SmsSurveyComponent } from './sms-survey/sms-survey.component';
import { SmsAvailabilityComponent } from './sms-availability/sms-availability.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full',
  },
  {
    path: 'subscription',
    component: SubscriptionComponent,
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'tabs',
    canActivate: [authGuard, subscriptionGuard],
    component: TabsContainerComponent,
    children: [
      {
        path: 'summary',
        outlet: 'summaryTab',
        component: SummaryComponent,
      },
      {
        path: 'jobs',
        outlet: 'jobListTab',
        component: JobsComponent,
      },
      {
        path: 'activate-service',
        outlet: 'jobListTab',
        component: ActivateServiceComponent,
      },
      {
        path: 'today',
        outlet: 'todayListTab',
        component: TodayComponent,
      },
      {
        path: 'customer-consent',
        outlet: 'todayListTab',
        component: CustomerConsentComponent,
      },
      {
        path: 'activate-service',
        outlet: 'todayListTab',
        component: ActivateServiceComponent,
      },
      {
        path: 'settings',
        outlet: 'settingsTab',
        component: SettingsComponent,
      },
      {
        path: 'residential-job-prices',
        outlet: 'settingsTab',
        component: ResidentialJobPricesComponent,
      },
      {
        path: 'xh-job-prices',
        outlet: 'settingsTab',
        component: XhJobPricesComponent,
      },
      {
        path: 'fiber-job-prices',
        outlet: 'settingsTab',
        component: FiberJobPricesComponent,
      },
      {
        path: 'business-job-prices',
        outlet: 'settingsTab',
        component: BusinessJobPricesComponent,
      },
      {
        path: 'payroll',
        outlet: 'settingsTab',
        component: PayrollComponent,
      },
      {
        path: 'xm-update-token',
        outlet: 'settingsTab',
        component: XmUpdateTokenComponent,
      },
      {
        path: 'sms-survey',
        outlet: 'settingsTab',
        component: SmsSurveyComponent,
      },
      {
        path: 'sms-availability',
        outlet: 'settingsTab',
        component: SmsAvailabilityComponent,
      },
    ],
  },
];
