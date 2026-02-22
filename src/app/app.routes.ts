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
        path: 'settings',
        outlet: 'settingsTab',
        component: SettingsComponent,
      },
    ],
  },
];
