import { AfterViewInit, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalDialogService, NativeScriptCommonModule, PageRouterOutlet } from '@nativescript/angular';
import { Color, isAndroid, isIOS, TabView } from '@nativescript/core';
import { Subscription } from 'rxjs';
import { NotificationsComponent } from '../notifications/notifications.component';
import { NotificationsService } from '../notifications/notifications.service';
import { TodayJobsCountService } from '../shared/services/today-jobs-count.service';
import { UsersService } from '../shared/services/users.service';

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
  private hasCheckedNotifications = false;
  private hasShownNotifications = false;

  constructor(
    private router: Router,
    private activeRoute: ActivatedRoute,
    private todayJobsCountService: TodayJobsCountService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef
  ) {}

  ngOnInit(): void {
    this.router.navigate(
      [
        {
          outlets: {
            summaryTab: ['summary'],
            jobListTab: ['jobs'],
            expensesTab: ['expenses'],
            todayListTab: ['today'],
            settingsTab: ['settings'],
          },
        },
      ],
      { relativeTo: this.activeRoute, replaceUrl: true }
    ).then(() => {
      this.checkActiveNotifications();
    });
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

  private checkActiveNotifications(): void {
    if (this.hasCheckedNotifications) {
      return;
    }

    const userId = Number(this.usersService.getUser()?.userId || 0);
    if (!userId) {
      return;
    }

    this.hasCheckedNotifications = true;
    this.notificationsService.findActiveByUser(userId).subscribe({
      next: (res: any) => {
        const notifications = this.normalizeNotifications(res);
        if (!notifications.length || this.hasShownNotifications) {
          return;
        }

        this.hasShownNotifications = true;
        const options: any = {
          context: { notifications, userId },
          viewContainerRef: this.vcRef,
          animated: true,
          fullscreen: false,
          stretched: false,
          cancelable: true,
          dismissEnabled: true,
          ios: {
            presentationStyle: UIModalPresentationStyle.Custom,
          },
        };

        setTimeout(() => {
          this.modalService.showModal(NotificationsComponent, options)
            .then((result: any) => {
              if (!result?.dontShowAgain || !result?.notificationId) {
                return;
              }

              this.notificationsService
                .markDismissed(Number(result.notificationId), userId)
                .subscribe({
                  error: (error) => {
                    console.log('[TabsContainer] markDismissed error', error);
                  },
                });
            })
            .catch((error) => {
              console.log('[TabsContainer] show notifications modal error', error);
              this.hasShownNotifications = false;
            });
        }, 250);
      },
      error: (error) => {
        console.log('[TabsContainer] findActive error', error);
      },
    });
  }

  private normalizeNotifications(res: any): any[] {
    if (Array.isArray(res)) {
      return res;
    }
    if (Array.isArray(res?.data)) {
      return res.data;
    }
    if (Array.isArray(res?.notifications)) {
      return res.notifications;
    }
    return [];
  }
}
