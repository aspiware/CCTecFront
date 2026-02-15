import { Routes } from '@angular/router';
import { SummaryComponent } from './summary/summary.component';
import { JobsComponent } from './jobs/jobs.component';
import { TodayComponent } from './today/today.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  {
    path: 'tab-summary',
    outlet: 'summaryTab',
    component: SummaryComponent,
  },
  {
    path: 'tab-jobs',
    outlet: 'jobListTab',
    component: JobsComponent,
  },
  {
    path: 'tab-today',
    outlet: 'todayListTab',
    component: TodayComponent,
  },
  {
    path: 'tab-settings',
    outlet: 'settingsTab',
    component: SettingsComponent,
  },
];
