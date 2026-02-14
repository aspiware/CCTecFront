import { Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { NativeScriptCommonModule, PageRouterOutlet } from '@nativescript/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'ns-app',
  templateUrl: './app.component.html',
  imports: [NativeScriptCommonModule, PageRouterOutlet],
  schemas: [NO_ERRORS_SCHEMA],
})
export class AppComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.navigate([
      {
        outlets: {
          summaryTab: ['tab-summary'],
          jobListTab: ['tab-jobs'],
          todayListTab: ['tab-today'],
          settingsTab: ['tab-settings'],
        },
      },
    ]);
  }
}
