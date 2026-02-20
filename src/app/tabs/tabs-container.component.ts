import { AfterViewInit, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NativeScriptCommonModule, PageRouterOutlet } from '@nativescript/angular';
import { isAndroid, isIOS, TabView } from '@nativescript/core';
import { Subscription } from 'rxjs';
import { TodayJobsCountService } from '../shared/services/today-jobs-count.service';

@Component({
  standalone: true,
  selector: 'tabs-container',
  imports: [NativeScriptCommonModule, PageRouterOutlet],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './tabs-container.component.html',
  styleUrl: './tabs-container.component.css',
})
export class TabsContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mainTabs', { static: true }) private mainTabsRef?: ElementRef<TabView>;
  private todayCountSub?: Subscription;
  private todayJobsCount = 0;
  private readonly todayTabIndex = 2;

  constructor(
    private router: Router,
    private activeRoute: ActivatedRoute,
    private todayJobsCountService: TodayJobsCountService
  ) {}

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

  ngAfterViewInit(): void {
    this.todayCountSub = this.todayJobsCountService.count$.subscribe((count) => {
      this.todayJobsCount = count;
      this.updateTodayTabBadge();
    });
  }

  ngOnDestroy(): void {
    this.todayCountSub?.unsubscribe();
  }

  private updateTodayTabBadge(): void {
    const count = this.todayJobsCount;
    const mainTabs = this.mainTabsRef?.nativeElement;

    if (isIOS) {
      const iosController = mainTabs?.ios;
      const tabBarItems = mainTabs?.ios?.tabBar?.items;
      const todayTabItem = tabBarItems?.objectAtIndex
        ? tabBarItems.objectAtIndex(this.todayTabIndex)
        : tabBarItems?.[this.todayTabIndex];
      const todayController = iosController?.viewControllers?.objectAtIndex
        ? iosController.viewControllers.objectAtIndex(this.todayTabIndex)
        : iosController?.viewControllers?.[this.todayTabIndex];

      if (todayTabItem) {
        todayTabItem.badgeValue = count > 0 ? `${count}` : null;
      }
      if (todayController?.tabBarItem) {
        todayController.tabBarItem.badgeValue = count > 0 ? `${count}` : null;
      }
      if (todayController?.tab) {
        todayController.tab.badgeValue = count > 0 ? `${count}` : null;
      }
      return;
    }

    if (isAndroid) {
      const tabLayout = (mainTabs as any)?._tabLayout ?? (mainTabs as any)?.nativeViewProtected?.tabLayout;
      const tab = tabLayout?.getTabAt?.(this.todayTabIndex);

      if (!tab || typeof tab.getOrCreateBadge !== 'function') {
        return;
      }

      if (count > 0) {
        const badge = tab.getOrCreateBadge();
        badge?.setVisible?.(true);
        badge?.setNumber?.(count);
      } else if (typeof tab.removeBadge === 'function') {
        tab.removeBadge();
      } else {
        tab.getBadge?.()?.setVisible?.(false);
      }
    }
  }
}
