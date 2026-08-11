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
    const subject = String(item?.subject || '').trim();
    if (subject) {
      return subject;
    }

    const unifiedType = String(item?.unifiedNoteType || '').trim();
    if (unifiedType) {
      return unifiedType;
    }

    const noteType = String(item?.noteType || '').trim();
    if (noteType) {
      return noteType.replace(/_/g, ' ');
    }

    return 'History';
  }

  public getHistoryDate(item: any): string {
    const raw = item?.dateWritten || item?.createdAt || item?.updatedAt || item?.timeSlotStartDateTime || item?.date;
    if (!raw) {
      return 'No date';
    }

    const numericRaw = Number(raw);
    const parsed = Number.isFinite(numericRaw) && numericRaw > 0
      ? new Date(numericRaw)
      : new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return String(raw);
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[parsed.getUTCMonth()];
    const day = parsed.getUTCDate();
    const year = parsed.getUTCFullYear();

    return `${month} ${day}, ${year}`;
  }

  public getHistoryStatus(item: any): string {
    return String(item?.noteType || item?.unifiedNoteType || item?.status || 'Unknown');
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

  public getHistoryAuthor(item: any): string {
    return String(item?.author || 'System');
  }

  public getHistoryComment(item: any): string {
    const raw = String(item?.comment || '').trim();
    if (!raw) {
      return '';
    }

    return raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .trim();
  }

  public itemStatusClass(item: any): string {
    const status = String(item?.noteType || item?.unifiedNoteType || item?.status || '').toUpperCase();
    if (status === 'JOB_NOTE') {
      return 'status-closed';
    }
    if (status === 'UNIFIED_NOTE') {
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
        comment: this.getHistoryComment(item),
      }))
      .sort((a, b) => {
        const aTime = Number(a?.dateWritten || new Date(a?.createdAt || a?.updatedAt || a?.timeSlotStartDateTime || 0).getTime());
        const bTime = Number(b?.dateWritten || new Date(b?.createdAt || b?.updatedAt || b?.timeSlotStartDateTime || 0).getTime());
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
        author: 'ADDAM PEREZ',
        dateWritten: String(baseDate - 1000 * 60 * 60 * 24 * 2),
        comment: '***THIS IS A PREPAID ACCOUNT. PLEASE REFERENCE HOW 13494 FOR PREPAID ACCOUNT SPECIFICS***',
        noteType: 'JOB_NOTE',
      },
      {
        author: 'bp-asuare710',
        dateWritten: String(baseDate - 1000 * 60 * 60 * 24),
        comment: 'Work Completed by ADDAM SUAREZ PEREZ (#9688):<br/>09:34 AM - Primary Resolution: FS3 FS INACTIVE OUTLET<br/>',
        noteType: 'UNIFIED_NOTE',
        unifiedNoteType: 'TECHNICIAN',
        subject: '',
      },
      {
        author: null,
        dateWritten: String(baseDate),
        comment: 'CEDAR RIDGE APARTMENTS',
        noteType: 'UNIFIED_NOTE',
        unifiedNoteType: 'LOCATION',
        subject: null,
      },
    ];
  }

  private syncTheme(): void {
    this.isDarkTheme = Application.systemAppearance() === 'dark';
  }
}
