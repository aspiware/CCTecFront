import { AfterViewInit, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NativeScriptCommonModule, PageRouterOutlet } from '@nativescript/angular';
import { Color, isAndroid, isIOS, TabView } from '@nativescript/core';
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
  private readonly todayBadgeBgColor = new Color('#E57373');
  private readonly todayBadgeTextColor = new Color('#FFFFFF');

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
      this.applyIosBadgeAppearance(iosController?.tabBar);
      const tabBarItems = mainTabs?.ios?.tabBar?.items;
      const todayTabItem = tabBarItems?.objectAtIndex
        ? tabBarItems.objectAtIndex(this.todayTabIndex)
        : tabBarItems?.[this.todayTabIndex];
      const todayController = iosController?.viewControllers?.objectAtIndex
        ? iosController.viewControllers.objectAtIndex(this.todayTabIndex)
        : iosController?.viewControllers?.[this.todayTabIndex];

      if (todayTabItem) {
        todayTabItem.badgeValue = count > 0 ? `${count}` : null;
        if (todayTabItem.badgeColor !== undefined) {
          todayTabItem.badgeColor = this.todayBadgeBgColor.ios;
        }
      }
      if (todayController?.tabBarItem) {
        todayController.tabBarItem.badgeValue = count > 0 ? `${count}` : null;
        if (todayController.tabBarItem.badgeColor !== undefined) {
          todayController.tabBarItem.badgeColor = this.todayBadgeBgColor.ios;
        }
      }
      if (todayController?.tab) {
        todayController.tab.badgeValue = count > 0 ? `${count}` : null;
        if (todayController.tab.badgeColor !== undefined) {
          todayController.tab.badgeColor = this.todayBadgeBgColor.ios;
        }
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
        badge?.setBackgroundColor?.(this.todayBadgeBgColor.android);
        badge?.setBadgeTextColor?.(this.todayBadgeTextColor.android);
      } else if (typeof tab.removeBadge === 'function') {
        tab.removeBadge();
      } else {
        tab.getBadge?.()?.setVisible?.(false);
      }
    }
  }

  private applyIosBadgeAppearance(tabBar: any): void {
    if (!tabBar?.standardAppearance) {
      return;
    }

    const appearance = tabBar.standardAppearance.copy ? tabBar.standardAppearance.copy() : tabBar.standardAppearance;
    const itemAppearances = [
      appearance?.stackedLayoutAppearance,
      appearance?.inlineLayoutAppearance,
      appearance?.compactInlineLayoutAppearance,
    ];

    itemAppearances.forEach((itemAppearance: any) => {
      if (!itemAppearance) {
        return;
      }
      if (itemAppearance.normal) {
        itemAppearance.normal.badgeBackgroundColor = this.todayBadgeBgColor.ios;
      }
      if (itemAppearance.selected) {
        itemAppearance.selected.badgeBackgroundColor = this.todayBadgeBgColor.ios;
      }
      if (itemAppearance.focused) {
        itemAppearance.focused.badgeBackgroundColor = this.todayBadgeBgColor.ios;
      }
      if (itemAppearance.disabled) {
        itemAppearance.disabled.badgeBackgroundColor = this.todayBadgeBgColor.ios;
      }
    });

    tabBar.standardAppearance = appearance;
    if (tabBar.scrollEdgeAppearance !== undefined) {
      tabBar.scrollEdgeAppearance = appearance;
    }
  }
}
