import { AfterViewInit, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalDialogService, NativeScriptCommonModule, PageRouterOutlet } from '@nativescript/angular';
import { Color, isAndroid, isIOS, TabView } from '@nativescript/core';
import { Subscription } from 'rxjs';
import { ForceUpdateComponent } from '../../../force-update/force-update.component';
import { VersionService } from '../../../shared/services/version.service';
import { EzeeOrdersService } from '../orders/ezee-orders.service';

@Component({
  standalone: true,
  selector: 'app-ezee-tabs-container',
  imports: [NativeScriptCommonModule, PageRouterOutlet],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-tabs-container.component.html',
  styleUrl: './ezee-tabs-container.component.scss',
})
export class EzeeTabsContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mainTabs', { static: true }) private mainTabsRef?: ElementRef<TabView>;
  private ordersCountSub?: Subscription;
  private todayOrdersCount = 0;
  private readonly todayTabIndex = 2;
  private readonly todayBadgeBgColor = new Color('#E57373');
  private readonly todayBadgeTextColor = new Color('#FFFFFF');
  private hasCheckedVersion = false;
  private hasShownForceUpdate = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ordersService: EzeeOrdersService,
    private versionService: VersionService,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef
  ) {}

  public ngOnInit(): void {
    this.router.navigate(
      [{
        outlets: {
          ezeeHomeTab: ['home'],
          ezeeJobsTab: ['jobs'],
          ezeeOrdersTab: ['orders'],
          ezeeExpensesTab: ['expenses'],
          ezeeSettingsTab: ['settings'],
        },
      }],
      { relativeTo: this.route, replaceUrl: true }
    ).then(() => {
      this.checkRequiredUpdate();
    });
  }

  public ngAfterViewInit(): void {
    this.ordersCountSub = this.ordersService.summary$.subscribe((summary) => {
      this.todayOrdersCount = Number(summary?.pending?.count || 0) + Number(summary?.completed?.count || 0);
      this.updateTodayTabBadge();
    });
  }

  public ngOnDestroy(): void {
    this.ordersCountSub?.unsubscribe();
  }

  private updateTodayTabBadge(): void {
    const count = this.todayOrdersCount;
    const mainTabs = this.mainTabsRef?.nativeElement;

    if (isIOS) {
      const iosController = mainTabs?.ios;
      this.applyIosBadgeAppearance(iosController?.tabBar);
      const tabBarItems = iosController?.tabBar?.items;
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

  private checkRequiredUpdate(): void {
    if (this.hasCheckedVersion) {
      return;
    }

    this.hasCheckedVersion = true;
    this.versionService.checkAppStoreVersion().subscribe((status) => {
      if (!status?.isUpdateAvailable || this.hasShownForceUpdate) {
        return;
      }

      this.hasShownForceUpdate = true;
      const options: any = {
        context: {
          localVersion: status.localVersion,
          storeVersion: status.storeVersion,
          appStoreUrl: status.appStoreUrl,
        },
        viewContainerRef: this.vcRef,
        animated: true,
        fullscreen: false,
        stretched: false,
        cancelable: false,
        dismissEnabled: false,
        ios: {
          presentationStyle: UIModalPresentationStyle.Custom,
        },
      };

      setTimeout(() => {
        this.modalService.showModal(ForceUpdateComponent, options).catch((error) => {
          console.log('[EzeeTabsContainer] show force update modal error', error);
          this.hasShownForceUpdate = false;
        });
      }, 200);
    });
  }
}
