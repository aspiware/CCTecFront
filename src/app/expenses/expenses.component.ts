import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { ModalDialogService, NativeScriptCommonModule } from '@nativescript/angular';
import { alert, Application, ObservableArray, Page, Screen, Utils } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomerInfoComponent } from '../customer-info/customer-info.component';
import { DevicesComponent } from '../devices/devices.component';
import { MenuEvent } from '../shared/components/menu-button/common';
import { Item } from '../shared/components/menu-button/item';
import { ExpensesService } from './expenses.service';
import { AddExpenseComponent } from './add-expense/add-expense.component';
import { EditJobComponent } from '../edit-job/edit-job.component';
import { UserModel } from '../shared/models/user.model';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';
import { WifiConfigComponent } from '../wifi-config/wifi-config.component';

@Component({
  standalone: true,
  selector: 'app-expenses',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
})
export class ExpensesComponent implements OnInit, OnDestroy {
  private readonly demoWeeklyTotal = 2062.75;
  private readonly demoJobs = this.buildDemoJobs();
  private readonly actionTapStates: Record<string, boolean> = {};
  private readonly actionTapTimers: Record<string, any> = {};
  private messageComposeDelegate: any;
  private isCopyMenuOpen = false;
  private lastCopyMenuTs = 0;
  private allJobs: any[] = [];
  private appearanceChangedHandler?: () => void;

  public user: UserModel | null = null;
  public isSyncing = false;
  public expenseList = new ObservableArray<any>([]);
  public totalAmount = 0;
  public startDate = this.createDefaultStartDate();
  public endDate = new Date();
  public todayDate = new Date();
  public isDemoMode = false;
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public expensesSearch = '';

  constructor(
    private usersService: UsersService,
    private expensesService: ExpensesService,
    private cdr: ChangeDetectorRef,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef,
    private configService: ConfigService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private page: Page
  ) {}

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    this.user = this.usersService.getUser();
    this.isDemoMode = this.usersService.isDemoUser(this.user);
    this.loadExpenses();
  }

  ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onStartDateChange(event: any): void {
    const nextDate = event?.value instanceof Date ? event.value : this.startDate;
    this.startDate = nextDate;
    if (this.startDate > this.endDate) {
      this.endDate = new Date(this.startDate);
    }
    this.loadExpenses();
  }

  public onEndDateChange(event: any): void {
    const nextDate = event?.value instanceof Date ? event.value : this.endDate;
    this.endDate = nextDate;
    if (this.endDate < this.startDate) {
      this.startDate = new Date(this.endDate);
    }
    this.loadExpenses();
  }

  public refreshExpenses(): void {
    this.loadExpenses();
  }

  public onExpensesSearchChange(value: string): void {
    this.expensesSearch = String(value || '');
    this.applyExpensesFilter();
  }

  public clearExpensesSearch(): void {
    if (!this.expensesSearch) {
      return;
    }
    this.expensesSearch = '';
    this.applyExpensesFilter();
  }

  public dismissKeyboard(): void {
    Utils.dismissKeyboard();
  }

  public getExpenseMenuOptions(item: any): Item['options'] {
    const options: Item['options'] = [
      {
        name: 'Copy Amount',
        icon: 'dollarsign.circle',
      },
    ];

    if (String(item?.displaySubtitle || '').trim()) {
      options.push({
        name: 'Copy Details',
        icon: 'doc.on.doc',
      });
    }

    return options;
  }

  public onSelectedExpenseMenu(event: MenuEvent, item: any): void {
    switch (Number(event?.index)) {
      case 0:
        Utils.copyToClipboard(String(item?.amount || 0));
        break;
      case 1:
        Utils.copyToClipboard(String(item?.displaySubtitle || ''));
        break;
      default:
        break;
    }
  }

  public onExpensesListLoaded(event: any): void {
    if (!__IOS__) {
      return;
    }

    const listView = event?.object;
    const iosListView = listView?.nativeViewProtected;
    const scrollView =
      iosListView?.scrollView ||
      iosListView?.collectionView ||
      iosListView?.tableView;

    if (scrollView) {
      scrollView.keyboardDismissMode = UIScrollViewKeyboardDismissMode.OnDrag;
    }
  }

  public addExpense(): void {
    const userId = Number(this.user?.userId || 0);
    if (!userId) {
      return;
    }

    const options: any = {
      context: { userId },
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

    this.modalService.showModal(AddExpenseComponent, options).then((result) => {
      if (result) {
        this.loadExpenses();
      }
    });
  }

  public onPullToRefresh(event: any): void {
    const listView = event?.object;
    this.loadExpenses(() => {
      listView?.notifyPullToRefreshFinished?.();
      listView?.scrollToIndex?.(0, false);
    });
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
        this.getCopyMenuTitle(type),
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
    }
  }

  public fiveDigitZip(zipcode: string | number | null | undefined): string {
    const digits = String(zipcode || '').replace(/\D/g, '');
    return digits.slice(0, 5);
  }

  public itemStatusClass(item: any): string {
    if (item?.isCurrent) {
      return 'status-current';
    }
    if (String(item?.status || '').toUpperCase() === 'CLOSED') {
      return 'status-closed';
    }
    if (String(item?.status || '').toUpperCase() === 'OPEN') {
      return 'status-open';
    }
    return 'status-default';
  }

  public itemStatusIcon(item: any): string {
    if (item?.isCurrent) {
      return '\uf111';
    }
    if (String(item?.status || '').toUpperCase() === 'CLOSED') {
      return '\uf058';
    }
    if (String(item?.status || '').toUpperCase() === 'OPEN') {
      return '\uf017';
    }
    return '\uf111';
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
      const surveySent = this.configService.getSurveySent(job?.number);
      job.sms_survey_sent = !!surveySent;
      this.cdr.detectChanges();
      this.clearJobActionTap(job, 'customer');
    });
  }

  public showEditJob(job: any): void {
    if (!job) {
      return;
    }

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
      },
    };

    this.modalService.showModal(EditJobComponent, options).then((result) => {
      if (result) {
        this.loadExpenses();
      }
      this.clearJobActionTap(job, 'edit');
    });
  }

  public showDevicesModal(job: any): void {
    if (!job) {
      return;
    }

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
      },
    };

    this.modalService.showModal(DevicesComponent, options).then((result: any) => {
      if (result?.navigateToActivateService) {
        setTimeout(() => {
          this.goToActivateService(result?.job || job);
        }, 0);
        return;
      }
      this.clearJobActionTap(job, 'devices');
    });
  }

  public goToActivateService(job?: any): void {
    const queryParams = this.buildActivateServiceQueryParams(job);
    this.router.navigate(['/tabs', { outlets: { jobListTab: ['activate-service'] } }], {
      queryParams,
    });
    if (job) {
      this.clearJobActionTap(job, 'activate-service');
    }
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

  private getCopyMenuTitle(type?: string): string {
    if (!type) {
      return 'Copy';
    }

    const normalized = String(type).trim().toLowerCase();
    if (!normalized) {
      return 'Copy';
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

  private syncTheme(): void {
    const appAppearance = Application.systemAppearance();
    if (appAppearance === 'dark' || appAppearance === 'light') {
      this.isDarkTheme = appAppearance === 'dark';
      return;
    }

    const pageClassName = String(this.page.className || '');
    this.isDarkTheme = pageClassName.includes('ns-dark');
  }

  private loadExpenses(onFinished?: () => void): void {
    if (this.isSyncing) {
      onFinished?.();
      return;
    }

    this.isSyncing = true;
    this.cdr.detectChanges();

    const startDate = this.formatDateParam(this.startOfDay(this.startDate));
    const endDate = this.formatDateParam(this.endOfDay(this.endDate));
    const userId = Number(this.user?.userId || 0);

    this.expensesService.findByUserAndDates(userId, startDate, endDate).subscribe({
      next: (res) => {
        console.log("[EXPENSES]", res)
        const expenses = this.normalizeExpensesResponse(res);
        this.applyExpensesForDisplay(expenses);
      },
      error: () => {
        this.applyExpensesForDisplay([]);
        this.isSyncing = false;
        this.cdr.detectChanges();
        onFinished?.();
      },
      complete: () => {
        this.isSyncing = false;
        this.cdr.detectChanges();
        onFinished?.();
      },
    });
  }

  private applyExpensesForDisplay(expenses: any[]): void {
    const normalizedExpenses = expenses
      .map((expense) => ({
        ...expense,
        amount: Number(expense?.amount || 0),
        files: this.parseJsonValue(expense?.files, []),
        displayTitle: this.buildExpenseTitle(expense),
        displaySubtitle: this.buildExpenseSubtitle(expense),
        displayTimestamp: this.buildExpenseTimestamp(expense),
        attachmentCount: this.getAttachmentCount(expense),
        displayIcon: this.buildExpenseIcon(expense),
      }))
      .sort((a, b) => {
        const aTime = new Date(a?.displayTimestamp || a?.createdAt || 0).getTime();
        const bTime = new Date(b?.displayTimestamp || b?.createdAt || 0).getTime();
        return bTime - aTime;
      });

    this.allJobs = normalizedExpenses;
    this.applyExpensesFilter();
  }

  private applyExpensesFilter(): void {
    const query = this.expensesSearch.trim().toLowerCase();
    const filteredJobs = !query
      ? [...this.allJobs]
      : this.allJobs.filter((job) => {
          const haystack = [
            job?.displayTitle,
            job?.displaySubtitle,
            job?.notes,
            job?.description,
            job?.name,
            job?.expenseTypeName,
            job?.expenseCategoryName,
          ]
            .map((value) => String(value || '').toLowerCase())
            .join(' ');

          return haystack.includes(query);
        });

    this.expenseList = new ObservableArray(filteredJobs);
    this.totalAmount = this.usersService.isDemoUser(this.user)
      ? this.demoWeeklyTotal
      : filteredJobs.reduce((sum, job) => sum + Number(job?.amount || 0), 0);
  }

  private normalizeExpensesResponse(response: any): any[] {
    if (this.usersService.isDemoUser(this.user)) {
      return this.filterDemoJobsByDateRange();
    }

    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.payload)) {
      return response.payload;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    if (Array.isArray(response?.data?.expenses)) {
      return response.data.expenses;
    }

    if (Array.isArray(response?.data?.payload)) {
      return response.data.payload;
    }

    if (Array.isArray(response?.expenses)) {
      return response.expenses;
    }

    if (Array.isArray(response?.jobs)) {
      return response.jobs;
    }

    return [];
  }

  private filterDemoJobsByDateRange(): any[] {
    const start = this.startOfDay(this.startDate).getTime();
    const end = this.endOfDay(this.endDate).getTime();

    return this.demoJobs.filter((job) => {
      const jobDate = new Date(job?.timeSlotStartDateTime || job?.createdAt || 0).getTime();
      return jobDate >= start && jobDate <= end;
    });
  }

  private formatDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private createDefaultStartDate(): Date {
    return this.startOfCurrentWeek(new Date());
  }

  private startOfCurrentWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  private buildActivateServiceQueryParams(job?: any): any {
    if (!job) {
      return {};
    }

    return {
      ...job,
      customer: this.stringifyQueryParam(job?.customer),
      devices: this.stringifyQueryParam(job?.devices),
      customJob: this.stringifyQueryParam(job?.customJob),
    };
  }

  private stringifyQueryParam(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private parseJsonValue<T>(value: any, fallback: T): T {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    if (typeof value !== 'string') {
      return value as T;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private buildExpenseTitle(expense: any): string {
    return String(
      expense?.expenseCategoryName ||
      expense?.expenseCategory?.name ||
      expense?.categoryName ||
      expense?.expenseTypeName ||
      expense?.expenseType?.name ||
      expense?.typeName ||
      expense?.name ||
      expense?.description ||
      'Expense'
    );
  }

  private buildExpenseSubtitle(expense: any): string {
    const parts = [
      expense?.expenseTypeName ||
      expense?.expenseType?.name ||
      expense?.typeName,
      expense?.notes,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return parts.join(' • ');
  }

  private buildExpenseTimestamp(expense: any): string {
    return String(
      expense?.expenseDate ||
      expense?.createdAt ||
      expense?.updatedAt ||
      ''
    );
  }

  public formatExpenseCardDate(value: string): string {
    if (!value) {
      return 'No date';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No date';
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()] || '';
    const day = date.getDate();
    return `${month} ${day}`;
  }

  public getExpenseAttachmentLabel(count: number): string {
    return String(Number(count || 0));
  }

  private buildExpenseIcon(expense: any): string {
    const haystack = [
      expense?.expenseTypeName,
      expense?.expenseCategoryName,
      expense?.notes,
      expense?.description,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .join(' ');

    if (haystack.includes('gas') || haystack.includes('fuel') || haystack.includes('gasoline')) {
      return '\uf52f';
    }

    if (haystack.includes('food') || haystack.includes('meal') || haystack.includes('restaurant')) {
      return '\uf2e7';
    }

    if (haystack.includes('hotel') || haystack.includes('lodging')) {
      return '\uf594';
    }

    if (haystack.includes('tool') || haystack.includes('material') || haystack.includes('supply')) {
      return '\uf1b3';
    }

    return '\uf555';
  }

  private getAttachmentCount(expense: any): number {
    const parsedFiles = this.parseJsonValue<any[]>(expense?.files, []);
    if (Array.isArray(parsedFiles) && parsedFiles.length) {
      return parsedFiles.length;
    }

    return Number(
      expense?.attachmentCount ||
      expense?.filesCount ||
      expense?.fileCount ||
      0
    );
  }

  private buildDemoJobs(): any[] {
    return [
      {
        id: 12648,
        jobDescription: 'TECH RECOVERY',
        description: '',
        amount: 52.33,
        address: '101 Demo Ave Apt 1',
        city: 'Clearview',
        state: 'TX',
        zipcode: '770010101',
        number: 'D-1001',
        accountNumber: '9900000000001001',
        jobUnits: 20,
        timeSlotStartDateTime: '2026-03-08T09:00:00-06:00',
        timeSlotEndDateTime: '2026-03-08T11:00:00-06:00',
        status: 'CLOSED',
        isCurrent: 0,
        sms_survey_sent: 0,
      },
      {
        id: 12650,
        jobDescription: 'TECH RECOVERY',
        description: '',
        amount: 52.33,
        address: '202 Review St',
        city: 'Northgate',
        state: 'TX',
        zipcode: '770020202',
        number: 'D-1002',
        accountNumber: '9900000000001002',
        jobUnits: 20,
        timeSlotStartDateTime: '2026-03-09T09:00:00-06:00',
        timeSlotEndDateTime: '2026-03-09T11:00:00-06:00',
        status: 'CLOSED',
        isCurrent: 0,
        sms_survey_sent: 0,
      },
      {
        id: 12652,
        jobDescription: 'VID UP',
        description: 'Upgrade',
        amount: 44.99,
        address: '303 Sample Court',
        city: 'Lakeside',
        state: 'TX',
        zipcode: '770030303',
        number: 'D-1003',
        accountNumber: '9900000000001003',
        jobUnits: 24,
        timeSlotStartDateTime: '2026-03-10T10:00:00-06:00',
        timeSlotEndDateTime: '2026-03-10T12:00:00-06:00',
        status: 'CLOSED',
        isCurrent: 0,
        sms_survey_sent: 0,
      },
      {
        id: 12658,
        jobDescription: 'HSD RC',
        description: 'Double Play Install',
        amount: 62.72,
        address: '404 Preview Lane',
        city: 'Bayview',
        state: 'TX',
        zipcode: '770040404',
        number: 'D-1004',
        accountNumber: '9900000000001004',
        jobUnits: 27,
        timeSlotStartDateTime: '2026-03-11T13:00:00-06:00',
        timeSlotEndDateTime: '2026-03-11T15:00:00-06:00',
        status: 'CLOSED',
        isCurrent: 0,
        sms_survey_sent: 0,
      },
      {
        id: 12659,
        jobDescription: 'TECH RECOVERY',
        description: '',
        amount: 52.33,
        address: '505 Sandbox Blvd Apt 8',
        city: 'Westfield',
        state: 'TX',
        zipcode: '770050505',
        number: 'D-1005',
        accountNumber: '9900000000001005',
        jobUnits: 20,
        timeSlotStartDateTime: '2026-03-12T15:00:00-06:00',
        timeSlotEndDateTime: '2026-03-12T17:00:00-06:00',
        status: 'CLOSED',
        isCurrent: 0,
        sms_survey_sent: 0,
      },
      {
        id: 12656,
        jobDescription: 'TECH RECOVERY',
        description: '',
        amount: 52.33,
        address: '606 Review Park Dr',
        city: 'Spring Harbor',
        state: 'TX',
        zipcode: '770060606',
        number: 'D-1006',
        accountNumber: '9900000000001006',
        jobUnits: 20,
        timeSlotStartDateTime: '2026-03-12T13:00:00-06:00',
        timeSlotEndDateTime: '2026-03-12T15:00:00-06:00',
        status: 'CLOSED',
        isCurrent: 0,
        sms_survey_sent: 0,
      },
      {
        id: 12674,
        jobDescription: 'HSD OUT',
        description: 'Trouble Call',
        amount: 36.65,
        address: '707 Example Ridge',
        city: 'River Oaks',
        state: 'TX',
        zipcode: '770070707',
        number: 'D-1007',
        accountNumber: '9900000000001007',
        jobUnits: 17,
        timeSlotStartDateTime: '2026-03-13T15:00:00-06:00',
        timeSlotEndDateTime: '2026-03-13T17:00:00-06:00',
        status: 'CLOSED',
        isCurrent: 0,
        sms_survey_sent: 0,
      },
      {
        id: 12677,
        jobDescription: 'TECH RECOVERY',
        description: '',
        amount: 52.33,
        address: '808 Mockingbird Way',
        city: 'Pine Hills',
        state: 'TX',
        zipcode: '770080808',
        number: 'D-1008',
        accountNumber: '9900000000001008',
        jobUnits: 20,
        timeSlotStartDateTime: '2026-03-14T08:00:00-06:00',
        timeSlotEndDateTime: '2026-03-14T20:00:00-06:00',
        status: 'CLOSED',
        isCurrent: 0,
        sms_survey_sent: 0,
      },
    ];
  }
}
