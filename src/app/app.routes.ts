import { Routes } from '@angular/router';
import { TodayTabPlaceholderComponent } from './tabs/placeholders/today-tab-placeholder.component';
import { SettingsTabPlaceholderComponent } from './tabs/placeholders/settings-tab-placeholder.component';
import { SummaryComponent } from './summary/summary.component';
import { JobsComponent } from './jobs/jobs.component';

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
    component: TodayTabPlaceholderComponent,
  },
  {
    path: 'tab-settings',
    outlet: 'settingsTab',
    component: SettingsTabPlaceholderComponent,
  },
];
