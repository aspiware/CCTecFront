import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Dialogs, ObservableArray } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { MenuEvent } from '../shared/components/menu-button';
import { Item } from '../shared/components/menu-button/item';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from '../today/today.service';

@Component({
  standalone: true,
  selector: 'app-job-history',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './job-history.component.html',
  styleUrl: './job-history.component.scss',
})
export class JobHistoryComponent implements OnInit, OnDestroy {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public job: any;
  public jobHistoryList = new ObservableArray<any>([]);
  public isRefreshingMainMenu = false;
  public isLoading = false;
  public loadError = '';
  private userId = 0;
  private appearanceChangedHandler?: () => void;

  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      {
        name: 'Refresh',
        icon: 'arrow.clockwise',
      },
    ],
  };

  constructor(
    private modalParams: ModalDialogParams,
    private usersService: UsersService,
    private todayService: TodayService,
    private cdr: ChangeDetectorRef
  ) {
    this.job = this.modalParams.context || {};
    this.userId = Number(this.usersService.getUser()?.userId || 0);
  }

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    this.loadJobHistory();
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

  public get mainMenuOptions(): Item['options'] {
    return this.mainMenu.options;
  }

  public closeWithoutSave(): void {
    this.modalParams.closeCallback({
      job: this.job,
    });
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    if (event?.index === 0) {
      this.loadJobHistory(true);
    }
  }

  public getHistoryTitle(item: any): string {
    const base = String(item?.jobDescription || item?.description || item?.status || 'History').trim();
    const extra = String(item?.description || '').trim();
    if (!extra || extra.toLowerCase() === base.toLowerCase()) {
      return base;
    }
    return `${base} - ${extra}`;
  }

  public getHistoryDate(item: any): string {
    const raw = item?.createdAt || item?.updatedAt || item?.timeSlotStartDateTime || item?.date;
    if (!raw) {
      return 'No date';
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return String(raw);
    }

    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  public getHistoryStatus(item: any): string {
    return String(item?.status || item?.jobStatus || 'Unknown');
  }

  public getHistoryAmount(item: any): string {
    const amount = Number(item?.amount || 0);
    return Number.isFinite(amount) && amount > 0 ? `$${amount.toFixed(2)}` : '';
  }

  public getHistoryAddress(item: any): string {
    const parts = [
      item?.address,
      item?.city,
      item?.state,
      this.fiveDigitZip(item?.zipcode),
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return parts.join(', ');
  }

  public itemStatusClass(item: any): string {
    const status = String(item?.status || item?.jobStatus || '').toUpperCase();
    if (status === 'CLOSED' || status === 'COMPLETE') {
      return 'status-closed';
    }
    if (status === 'OPEN' || status === 'PENDING') {
      return 'status-open';
    }
    return 'status-default';
  }

  public fiveDigitZip(zipcode: string | number | null | undefined): string {
    const digits = String(zipcode || '').replace(/\D/g, '');
    return digits.slice(0, 5);
  }

  private loadJobHistory(isManualRefresh = false): void {
    if (this.isLoading) {
      return;
    }

    const accountNumber = String(this.job?.accountNumber || '').trim();
    const workOrderNumber = String(this.job?.workOrderNumber || '').trim();
    if (!this.userId || !accountNumber || !workOrderNumber) {
      Dialogs.alert({
        title: 'Job History',
        message: 'Missing data to load job history.',
        okButtonText: 'OK',
      });
      return;
    }

    this.isLoading = true;
    this.isRefreshingMainMenu = isManualRefresh;
    this.loadError = '';
    this.cdr.detectChanges();

    if (this.usersService.isDemoUser()) {
      this.applyHistory(this.buildDemoHistory());
      this.finishLoading();
      return;
    }

    this.todayService.getJobHistory(this.userId, accountNumber, workOrderNumber).subscribe({
      next: (res) => {
        console.log('[JobHistory] getJobHistory', res);
        this.applyHistory(this.normalizeHistoryResponse(res));
      },
      error: (error) => {
        console.log('[JobHistory] getJobHistory error', error);
        this.jobHistoryList = new ObservableArray<any>([]);
        this.loadError = String(error?.error?.message || error?.message || 'Failed to load job history.');
        this.finishLoading();
      },
      complete: () => {
        this.finishLoading();
      },
    });
  }

  private finishLoading(): void {
    this.isLoading = false;
    this.isRefreshingMainMenu = false;
    this.cdr.detectChanges();
  }

  private applyHistory(history: any[]): void {
    const normalized = history
      .map((item) => ({
        ...item,
        amount: Number(item?.amount || 0),
      }))
      .sort((a, b) => {
        const aTime = new Date(a?.createdAt || a?.updatedAt || a?.timeSlotStartDateTime || 0).getTime();
        const bTime = new Date(b?.createdAt || b?.updatedAt || b?.timeSlotStartDateTime || 0).getTime();
        return bTime - aTime;
      });

    this.jobHistoryList = new ObservableArray(normalized);
  }

  private normalizeHistoryResponse(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response?.payload)) {
      return response.payload;
    }
    if (Array.isArray(response?.history)) {
      return response.history;
    }
    if (Array.isArray(response?.data)) {
      return response.data;
    }
    return [];
  }

  private buildDemoHistory(): any[] {
    const baseDate = new Date('2026-08-08T10:00:00-05:00').getTime();
    return [
      {
        jobDescription: this.job?.jobDescription || 'Tech Recovery',
        description: 'Initial assignment',
        status: 'OPEN',
        accountNumber: this.job?.accountNumber,
        workOrderNumber: this.job?.workOrderNumber,
        number: this.job?.number,
        address: this.job?.address,
        city: this.job?.city,
        state: this.job?.state,
        zipcode: this.job?.zipcode,
        createdAt: new Date(baseDate - 1000 * 60 * 60 * 24 * 2).toISOString(),
      },
      {
        jobDescription: this.job?.jobDescription || 'Tech Recovery',
        description: 'Customer updated',
        status: 'PENDING',
        accountNumber: this.job?.accountNumber,
        workOrderNumber: this.job?.workOrderNumber,
        number: this.job?.number,
        address: this.job?.address,
        city: this.job?.city,
        state: this.job?.state,
        zipcode: this.job?.zipcode,
        createdAt: new Date(baseDate - 1000 * 60 * 60 * 24).toISOString(),
      },
      {
        jobDescription: this.job?.jobDescription || 'Tech Recovery',
        description: 'Closed successfully',
        status: 'CLOSED',
        amount: this.job?.amount,
        accountNumber: this.job?.accountNumber,
        workOrderNumber: this.job?.workOrderNumber,
        number: this.job?.number,
        address: this.job?.address,
        city: this.job?.city,
        state: this.job?.state,
        zipcode: this.job?.zipcode,
        notes: this.job?.notes,
        createdAt: new Date(baseDate).toISOString(),
      },
    ];
  }

  private syncTheme(): void {
    this.isDarkTheme = Application.systemAppearance() === 'dark';
  }
}
