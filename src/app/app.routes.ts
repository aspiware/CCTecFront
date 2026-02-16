import { Routes } from '@angular/router';
import { TabsContainerComponent } from './tabs/tabs-container.component';
import { SummaryComponent } from './summary/summary.component';
import { JobsComponent } from './jobs/jobs.component';
import { TodayComponent } from './today/today.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
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
        path: 'settings',
        outlet: 'settingsTab',
        component: SettingsComponent,
      },
    ],
  },
];
