import { Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NativeScriptCommonModule, PageRouterOutlet } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'app-ezee-tabs-container',
  imports: [NativeScriptCommonModule, PageRouterOutlet],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-tabs-container.component.html',
  styleUrl: './ezee-tabs-container.component.scss',
})
export class EzeeTabsContainerComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this.router.navigate(
      [{
        outlets: {
          ezeeHomeTab: ['home'],
          ezeeOrdersTab: ['orders'],
          ezeeSettingsTab: ['settings'],
        },
      }],
      { relativeTo: this.route, replaceUrl: true }
    );
  }
}
