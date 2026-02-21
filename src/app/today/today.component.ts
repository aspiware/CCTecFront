import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit, ViewContainerRef } from '@angular/core';
import { ModalDialogService, NativeScriptCommonModule } from '@nativescript/angular';
import { Application, ObservableArray, Screen, Utils } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { UserModel } from '../shared/models/user.model';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from './today.service';
import { map } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';
import { Router } from '@angular/router';
import { WifiConfigComponent } from '../wifi-config/wifi-config.component';
import { TodayJobsCountService } from '../shared/services/today-jobs-count.service';
import { CustomerInfoComponent } from '../customer-info/customer-info.component';

@Component({
  standalone: true,
  selector: 'app-today',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss',
})
export class TodayComponent implements OnInit {
  public user: UserModel;
  public jobList: ObservableArray<any>;
  public originalJobList: ObservableArray<any>;
  public starredJobList: ObservableArray<any>;
  public todayTotal = 0;
  public units = 0;
  public weeklyTotal = 0;
  public starredCount = 0;
  public mainMenuIconName = 'ellipsis.circle';
  public item: any;
  scansMenu: Item =
    {
      name: 'Scans',
      options: [
        { name: 'Ingress Scans', icon: 'waveform.path' },
        { name: 'PHT Scans', icon: 'chart.bar.xaxis' },
        { name: 'Bonding Validation', icon: 'tag' },
        { name: 'XM Photo', icon: 'photo.fill' },
        {
          name: 'End of Day', icon: 'circle.slash.fill', destructive: true, confirm: {
            title: 'Do you want to log off for the day?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        }
      ],
    };
  jobMenu: Item =
    {
      name: 'Job Menu',
      options: [
        { name: 'Go Enroute', icon: 'car.fill' },
        { name: 'Go On Job', icon: 'wrench.fill' },
        { name: 'Complete Job', icon: 'checkmark.circle.fill' },
        // { name: 'Set ETC', icon: 'clock.fill' },
        { name: 'Set Location', icon: 'mappin.and.ellipse' },
      ],
    };
  mainMenu: Item =
    {
      name: 'Main Menu',
      options: [
        { name: 'Available', icon: 'checkmark.circle.fill' },
        { name: 'Lunch', icon: 'fork.knife.circle.fill' },
        { name: 'Tech Log', icon: 'network' },
        { name: 'Meeting', icon: 'inset.filled.rectangle.and.person.filled' },
        { name: 'Logged On', icon: 'iphone.and.arrow.right.outward' },
        {
          name: 'End of Day', icon: 'circle.slash.fill', destructive: true, confirm: {
            title: 'Do you want to log off for the day?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };
  mainMenuR: Item =
    {
      name: 'Main Menu Right',
      options: [
        { name: 'Location', icon: 'mappin.and.ellipse' },
        { name: 'Gate Codes', icon: 'square.grid.3x3' },
        { name: 'Customer Consent', icon: 'signature' },
        { name: 'Report Bug', icon: 'bubble.left.and.exclamationmark.bubble.right' },
        {
          name: 'Log Out', icon: 'person.crop.circle.badge.xmark', destructive: true, confirm: {
            title: 'Are you sure you want to log out?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };
  public isSyncing = false;
  public isOnShift: boolean;
  public techStatus: boolean;
  public isTechStatusLoading = false;
  public lastKnownTechStatus = 'AVAIL';
  showStarred = false;
  private isCopyMenuOpen = false;
  private lastCopyMenuTs = 0;
  private messageComposeDelegate: any;
  private actionTapStates: { [key: string]: boolean } = {};
  private actionTapTimers: { [key: string]: ReturnType<typeof setTimeout> } = {};

  constructor(
    private usersService: UsersService,
    private todayService: TodayService,
    private configService: ConfigService,
    private todayJobsCountService: TodayJobsCountService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef
  ) { }

  ngOnInit(): void {
    this.jobList = new ObservableArray([]);
    this.user = this.usersService.getUser() || { userId: 15 };
    this.mainMenuIconName = 'questionmark';
    this.getWorkOrders();
  }

  public getWorkOrders(onFinished?: () => void): void {
    if (this.isSyncing) {
      onFinished?.();
      return;
    }

    this.isSyncing = true;
    this.cdr.detectChanges();

    const userId = this.user?.userId || 0;
    let pending = 2;
    const onDone = () => {
      pending -= 1;
      if (pending <= 0) {
        this.isSyncing = false;
        onFinished?.();
      }
      this.cdr.detectChanges();
    };

    this.hasLunch();
    this.getTechStatus();

    // starred jobs implemented
    // getWorkOrder implemented
    this.todayService.getWorkOrders(userId).pipe(
      map(res => {
        return res.map(job => {
          const surveySent = this.configService.getSurveySent(job.number);
          // console.log('SURVEYSENT OF EACH JOB', surveySent)

          const isStarred = this.configService.isJobStarred(job.number);
          if (isStarred) {
            this.configService.setStarredJob(job, true);
          }
          return {
            ...job,
            sms_survey_sent: surveySent ? true : false,
            isStarred
          };
        });
      })
    ).subscribe({
      next: (res) => {
        console.log('ORDERS1', res);

        this.originalJobList = new ObservableArray(res);
        this.todayJobsCountService.setCount(this.originalJobList.length);
        if (!this.starredJobList) {
          this.starredJobList = new ObservableArray([]);
        }

        this.rebuildStarredList();
        // Inicializa como ObservableArray
        this.jobList.splice(0);     // limpia
        const listToShow = this.showStarred ? this.starredJobList : this.originalJobList;
        this.jobList.push(...listToShow);  // agrega nuevos elementos

        // const jobs = Array.isArray(res?.jobs) ? res.jobs : (Array.isArray(res) ? res : []);
        // this.jobList = new ObservableArray(jobs);
        this.todayTotal = res
          .filter((job) => job?.status === 'CLOSED')
          .reduce((total, job) => total + Number(job?.amount || 0), 0);
        this.units = res.reduce((total, job) => total + Number(job?.jobUnits || 0), 0);
        onDone();
      }, error: (error) => {
        console.log(error);
        this.todayJobsCountService.setCount(0);
        onDone()

        // new Toasty({ text: error })
        //   .setToastDuration(ToastDuration.LONG)
        //   .setToastPosition(ToastPosition.TOP)
        //   .setTextColor(new Color("white"))
        //   .setBackgroundColor(new Color("gray"))
        //   .show();
      }
    })

    // this.todayService.findTodayByUser(userId).subscribe({
    //   next: (res) => {
    //     console.log(res.jobs);

    //     const jobs = Array.isArray(res?.jobs) ? res.jobs : (Array.isArray(res) ? res : []);
    //     this.jobList = new ObservableArray(jobs);
    //     this.todayTotal = jobs
    //       .filter((job) => job?.status === 'CLOSED')
    //       .reduce((total, job) => total + Number(job?.amount || 0), 0);
    //     this.units = jobs.reduce((total, job) => total + Number(job?.jobUnits || 0), 0);
    //     onDone();
    //   },
    //   error: () => onDone(),
    // });

    this.todayService.getTotalCurrentWeek(userId).subscribe({
      next: (res) => {
        this.weeklyTotal = Number(res?.total || res || 0);
        onDone();
      },
      error: () => onDone(),
    });
  }

  private rebuildStarredList() {
    if (!this.starredJobList) {
      this.starredJobList = new ObservableArray([]);
    }

    this.starredJobList.splice(0);
    const starredMap = this.configService.getStarredJobs();
    const starredJobs: any[] = [];

    Object.keys(starredMap || {}).forEach((key) => {
      const stored = starredMap[key];
      const latest = this.originalJobList?.find((job) => String(job.number) === String(key));

      if (latest) {
        latest.isStarred = true;
        starredJobs.push(latest);
        this.configService.setStarredJob(latest, true);
        return;
      }

      if (stored && stored !== true) {
        stored.isStarred = true;
        starredJobs.push(stored);
      }
    });

    if (starredJobs.length) {
      this.starredJobList.push(...starredJobs);
    }

    this.starredCount = this.starredJobList.length;
  }

  toggleStarredView(event: any) {
    this.showStarred = !!event?.object?.checked;
    this.rebuildStarredList();

    if (!this.jobList) {
      this.jobList = new ObservableArray([]);
    }

    this.jobList.splice(0);
    const listToShow = this.showStarred ? this.starredJobList : this.originalJobList;
    listToShow && this.jobList.push(...listToShow);
  }

  setStarred(item: any) {
    if (!item) {
      return;
    }
    item.isStarred = !item.isStarred;
    if (item.number !== undefined && item.number !== null) {
      this.configService.setStarredJob(item, item.isStarred);
    }
    this.rebuildStarredList();
    if (this.showStarred) {
      this.jobList.splice(0);
      this.jobList.push(...this.starredJobList);
    }
  }

  public markJobActionTap(item: any, action: string, autoClearMs = 140): void {
    const key = `${item?.number || 'unknown'}:${action}`;
    this.actionTapStates[key] = true;
    this.cdr.detectChanges();

    if (this.actionTapTimers[key]) {
      clearTimeout(this.actionTapTimers[key]);
    }

    if (autoClearMs > 0) {
      this.actionTapTimers[key] = setTimeout(() => {
        this.actionTapStates[key] = false;
        this.cdr.detectChanges();
      }, autoClearMs);
    }
  }

  public isJobActionTapped(item: any, action: string): boolean {
    const key = `${item?.number || 'unknown'}:${action}`;
    return !!this.actionTapStates[key];
  }

  public clearJobActionTap(item: any, action: string): void {
    const key = `${item?.number || 'unknown'}:${action}`;
    if (this.actionTapTimers[key]) {
      clearTimeout(this.actionTapTimers[key]);
      delete this.actionTapTimers[key];
    }
    this.actionTapStates[key] = false;
    this.cdr.detectChanges();
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    console.log('[Today] mainMenuR selected', event?.index);

    switch (event?.index) {
      case 2:
        this.router.navigate(['/tabs', { outlets: { todayListTab: ['customer-consent'] } }]);
        break;
      default:
        break;
    }
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    const selected = this.mainMenu?.options?.[event?.index || 0];
    switch (event?.index) {
      case 0:
        this.updateTechStatusMenu('AVAIL', 'AVAIL', selected?.icon);
        break;
      case 1:
        this.updateTechStatusMenu('LUNCH', 'AVAIL', selected?.icon);
        break;
      case 2:
        this.updateTechStatusMenu('TLOGISTICS', 'AVAIL', selected?.icon);
        break;
      case 3:
        this.updateTechStatusMenu('MEETING', 'AVAIL', selected?.icon);
        break;
      case 4:
        this.updateTechStatusMenu('LON', 'AVAIL', selected?.icon);
        break;
      case 5:
        this.updateTechStatusMenu('EOD', 'AVAIL', selected?.icon);
        break;
    }
  }

  public selected(event: MenuEvent, item?: any): void {
    console.log('[Today] selected', event?.index, item);
  }

  public onPullToRefresh(event: any): void {
    const listView = event?.object;
    if (this.isSyncing) {
      listView?.notifyPullToRefreshFinished?.();
      return;
    }
    this.getWorkOrders(() => {
      listView?.notifyPullToRefreshFinished?.();
      listView?.scrollToIndex?.(0, false);

    });
  }

  public onItemTap(event: any): void {
    const tappedItem = this.jobList?.getItem?.(event?.index);
    console.log('[Today] item tap', tappedItem?.number);
  }

  public wifiConfig(job: any): void {
    if (!job) {
      return;
    }

    const modalWidth = Math.min(380, Math.max(300, Screen.mainScreen.widthDIPs - 32));
    const modalHeight = Math.min(620, Math.max(420, Screen.mainScreen.heightDIPs - 120));

    const options: any = {
      context: job,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
        // width: modalWidth,
        // height: modalHeight,
      },
    };

    this.modalService.showModal(WifiConfigComponent, options).then((result) => {
      this.clearJobActionTap(job, 'wifi');

      if (!result) {
        return;
      }

      if (!__IOS__) {
        return;
      }

      if (typeof MFMessageComposeViewController === 'undefined' || !MFMessageComposeViewController.canSendText()) {
        return;
      }

      const recipients = Array.isArray(result?.numbers)
        ? result.numbers.filter((n: any) => !!n).map((n: any) => String(n))
        : [];
      const body = String(result?.wifiData || '');
      // Wait one run-loop so Wifi modal is fully dismissed before presenting SMS composer.
      setTimeout(() => this.presentSmsComposer(recipients, body), 150);
    });
  }

  public showCustomerInfo(job: any): void {
    if (!job) {
      return;
    }

    const modalWidth = Math.min(380, Math.max(300, Screen.mainScreen.widthDIPs - 32));
    const modalHeight = Math.min(620, Math.max(420, Screen.mainScreen.heightDIPs - 120));

    const options: any = {
      context: job,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
        // width: modalWidth,
        // height: modalHeight,
      },
    };

    this.modalService.showModal(CustomerInfoComponent, options).then(() => {
      this.clearJobActionTap(job, 'customer');
    });
  }

  private presentSmsComposer(recipients: string[], body: string): void {
    const controller = MFMessageComposeViewController.new();
    const MessageComposeDelegate = (NSObject as any).extend(
      {
        messageComposeViewControllerDidFinishWithResult: (
          msgController: MFMessageComposeViewController,
          _msgResult: MessageComposeResult
        ) => {
          msgController.dismissViewControllerAnimatedCompletion(true, null);
          this.messageComposeDelegate = null;
        },
      },
      {
        protocols: [MFMessageComposeViewControllerDelegate],
      }
    );

    this.messageComposeDelegate = MessageComposeDelegate.new();
    controller.body = body;
    controller.recipients = recipients as any;
    controller.messageComposeDelegate = this.messageComposeDelegate;
    (controller as any).__delegate = this.messageComposeDelegate;

    const root = Application.ios?.rootController;
    let presenter = root as UIViewController;
    while (presenter?.presentedViewController) {
      presenter = presenter.presentedViewController;
    }
    presenter?.presentViewControllerAnimatedCompletion(controller, true, null);
  }

  public itemStatusIcon(item: any): string {
    if (item?.status === 'CLOSED') {
      return '\uf058';
    }
    if (item?.status === 'OPEN' && item?.isCurrent) {
      return '\uf017';
    }
    if (item?.status === 'OPEN') {
      return '\uf49e';
    }
    return '\uf111';
  }

  public itemStatusClass(item: any): string {
    if (item?.status === 'CLOSED') {
      return 'status-closed';
    }
    if (item?.status === 'OPEN' && item?.isCurrent) {
      return 'status-current';
    }
    if (item?.status === 'OPEN') {
      return 'status-open';
    }
    return 'status-default';
  }

  public fiveDigitZip(zipcode: any): string {
    const zip = String(zipcode || '').trim();
    if (zip.includes('-')) {
      return zip.split('-')[0];
    }
    return zip.slice(0, 5);
  }

  private hasLunch(): void {
    const userId = this.user?.userId || 0;
    this.todayService.hasLunch(userId).subscribe({
      next: (res) => {
        this.isOnShift = !!(res?.hasLunch ?? res);
        this.cdr.detectChanges();
      },
      error: () => {
        this.isOnShift = false;
        this.cdr.detectChanges();
      },
    });
  }

  private getTechStatus(): void {
    const userId = this.user?.userId || 0;

    if (this.isTechStatusLoading) {
      return;
    }

    setTimeout(() => {
      this.isTechStatusLoading = true;
    })

    this.todayService.getTechStatus(userId).subscribe({
      next: (res) => {
        console.log('TECH_STATUS', res);

        const status = String(res?.data?.techStatus || '').toUpperCase();

        if (!status) {
          return;
        }

        this.lastKnownTechStatus = status;
        this.isTechStatusLoading = false;

        switch (status) {
          case 'AVAIL':
            this.mainMenuIconName = this.mainMenu.options[0]?.icon || this.mainMenuIconName;
            break;
          case 'LUNCH':
            this.mainMenuIconName = this.mainMenu.options[1]?.icon || this.mainMenuIconName;
            break;
          case 'TLOGISTICS':
            this.mainMenuIconName = this.mainMenu.options[2]?.icon || this.mainMenuIconName;
            break;
          case 'MEETING':
            this.mainMenuIconName = this.mainMenu.options[3]?.icon || this.mainMenuIconName;
            break;
          case 'LON':
            this.mainMenuIconName = this.mainMenu.options[4]?.icon || this.mainMenuIconName;
            break;
          case 'LOFF':
            this.mainMenuIconName = this.mainMenu.options[5]?.icon || this.mainMenuIconName;
            break;
          case 'ENROUTE':
            this.mainMenuIconName = 'car';
            break;
          case 'ONJOB':
            this.mainMenuIconName = 'wrench.adjustable.fill';
            break;
        }
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.log(e)
        this.isTechStatusLoading = false;
      },
    });
  }

  private updateTechStatusMenu(
    techStatus: string,
    lastKnownTechStatus: string = 'AVAIL',
    selectedIcon?: string
  ): void {
    if (this.isTechStatusLoading) {
      return;
    }

    const userId = this.user?.userId || 0;
    this.isTechStatusLoading = true;
    this.cdr.detectChanges();

    this.todayService.updateTechStatusMenu(userId, techStatus, lastKnownTechStatus).subscribe({
      next: () => {
        this.lastKnownTechStatus = techStatus;

        if (selectedIcon) {
          this.mainMenuIconName = selectedIcon;
        }

        this.isTechStatusLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isTechStatusLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  getFiveDigitZipCode(zip: string): string {
    return zip.substring(0, 5);
  }

  public showMenu(args: any, value: any, type?: string): void {
    if (args && typeof args.cancel === 'boolean') {
      args.cancel = true;
    }

    const now = Date.now();
    if (this.isCopyMenuOpen || now - this.lastCopyMenuTs < 500) {
      return;
    }

    const textToCopy = String(value ?? '').trim();
    if (!textToCopy) {
      return;
    }

    if (__IOS__) {
      this.isCopyMenuOpen = true;
      this.lastCopyMenuTs = now;

      let viewController = Application.ios?.rootController;
      while (
        viewController &&
        viewController.presentedViewController &&
        !viewController.presentedViewController.beingDismissed
      ) {
        viewController = viewController.presentedViewController;
      }
      if (!viewController?.view) {
        this.isCopyMenuOpen = false;
        return;
      }

      const sourceView = args?.object?.ios as UIView | undefined;
      const alert = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
        type === 'address' ? 'Address' : 'Copy',
        textToCopy,
        UIAlertControllerStyle.ActionSheet
      );

      const copyAction = UIAlertAction.actionWithTitleStyleHandler(
        'Copy',
        UIAlertActionStyle.Default,
        () => {
          UIPasteboard.generalPasteboard.string = textToCopy;
          this.isCopyMenuOpen = false;
        }
      );
      copyAction.setValueForKey(UIImage.systemImageNamed('doc.on.doc'), 'image');
      alert.addAction(copyAction);

      if (type === 'address') {
        const goAction = UIAlertAction.actionWithTitleStyleHandler(
          'Go',
          UIAlertActionStyle.Default,
          () => {
            this.isCopyMenuOpen = false;
            this.showMapOptions(sourceView, textToCopy);
          }
        );
        goAction.setValueForKey(UIImage.systemImageNamed('location'), 'image');
        alert.addAction(goAction);
      }

      alert.addAction(
        UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, () => {
          this.isCopyMenuOpen = false;
        })
      );

      const popover = alert.popoverPresentationController;
      if (popover) {
        popover.sourceView = sourceView || viewController.view;
        popover.sourceRect = sourceView
          ? sourceView.bounds
          : CGRectMake(
            viewController.view.bounds.size.width / 2,
            viewController.view.bounds.size.height / 2,
            1,
            1
          );
        popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
      }

      viewController.presentViewControllerAnimatedCompletion(alert, true, null);
      return;
    }
  }

  private showMapOptions(sourceView: UIView | undefined, address: string): void {
    if (!__IOS__) {
      return;
    }

    let viewController = Application.ios?.rootController;
    while (
      viewController &&
      viewController.presentedViewController &&
      !viewController.presentedViewController.beingDismissed
    ) {
      viewController = viewController.presentedViewController;
    }
    if (!viewController?.view) {
      return;
    }

    const alert = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      'Open With',
      address,
      UIAlertControllerStyle.ActionSheet
    );

    const appleAction = UIAlertAction.actionWithTitleStyleHandler(
      'iOS Map',
      UIAlertActionStyle.Default,
      () => {
        const query = encodeURIComponent(address);
        Utils.openUrl(`http://maps.apple.com/?q=${query}`);
      }
    );
    appleAction.setValueForKey(UIImage.systemImageNamed('map'), 'image');
    alert.addAction(appleAction);

    const googleAction = UIAlertAction.actionWithTitleStyleHandler(
      'Google Map',
      UIAlertActionStyle.Default,
      () => {
        const query = encodeURIComponent(address);
        const googleAppUrl = `comgooglemaps://?q=${query}`;
        const googleWebUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
        const opened = Utils.openUrl(googleAppUrl);
        if (!opened) {
          Utils.openUrl(googleWebUrl);
        }
      }
    );
    googleAction.setValueForKey(UIImage.systemImageNamed('globe'), 'image');
    alert.addAction(googleAction);

    alert.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, null)
    );

    const popover = alert.popoverPresentationController;
    if (popover) {
      popover.sourceView = sourceView || viewController.view;
      popover.sourceRect = sourceView
        ? sourceView.bounds
        : CGRectMake(
          viewController.view.bounds.size.width / 2,
          viewController.view.bounds.size.height / 2,
          1,
          1
        );
      popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
    }

    viewController.presentViewControllerAnimatedCompletion(alert, true, null);
  }
}
