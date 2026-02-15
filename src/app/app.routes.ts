import { Routes } from '@angular/router';
import { SettingsTabPlaceholderComponent } from './tabs/placeholders/settings-tab-placeholder.component';
import { SummaryComponent } from './summary/summary.component';
import { JobsComponent } from './jobs/jobs.component';
import { TodayComponent } from './today/today.component';

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
    component: SettingsTabPlaceholderComponent,
  },
];
