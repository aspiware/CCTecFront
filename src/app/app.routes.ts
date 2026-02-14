import { Routes } from '@angular/router';
import { SummaryTabPlaceholderComponent } from './tabs/placeholders/summary-tab-placeholder.component';
import { JobsTabPlaceholderComponent } from './tabs/placeholders/jobs-tab-placeholder.component';
import { TodayTabPlaceholderComponent } from './tabs/placeholders/today-tab-placeholder.component';
import { SettingsTabPlaceholderComponent } from './tabs/placeholders/settings-tab-placeholder.component';

export const routes: Routes = [
  {
    path: 'tab-summary',
    outlet: 'summaryTab',
    component: SummaryTabPlaceholderComponent,
  },
  {
    path: 'tab-jobs',
    outlet: 'jobListTab',
    component: JobsTabPlaceholderComponent,
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
