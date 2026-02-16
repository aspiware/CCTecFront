import { Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NativeScriptCommonModule, PageRouterOutlet } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'tabs-container',
  imports: [NativeScriptCommonModule, PageRouterOutlet],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './tabs-container.component.html',
  styleUrl: './tabs-container.component.css',
})
export class TabsContainerComponent implements OnInit {
  constructor(private router: Router, private activeRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.router.navigate(
      [
        {
          outlets: {
            summaryTab: ['summary'],
            jobListTab: ['jobs'],
            todayListTab: ['today'],
            settingsTab: ['settings'],
          },
        },
      ],
      { relativeTo: this.activeRoute, replaceUrl: true }
    );
  }
}
