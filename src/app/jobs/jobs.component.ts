import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { ObservableArray } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { SettingsService } from '../settings/settings.service';
import { UserModel } from '../shared/models/user.model';
import { UsersService } from '../shared/services/users.service';

@Component({
  standalone: true,
  selector: 'app-jobs',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './jobs.component.html',
  styleUrl: './jobs.component.scss',
})
export class JobsComponent implements OnInit {
  private readonly demoWeeklyTotal = 2062.75;
  private readonly demoJobs = this.buildDemoJobs();

  public user: UserModel | null = null;
  public isSyncing = false;
  public jobList = new ObservableArray<any>([]);
  public totalAmount = 0;
  public startDate = this.createDefaultStartDate();
  public endDate = new Date();
  public todayDate = new Date();

  constructor(
    private usersService: UsersService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.user = this.usersService.getUser();
    this.loadJobs();
  }

  public onStartDateChange(event: any): void {
    const nextDate = event?.value instanceof Date ? event.value : this.startDate;
    this.startDate = nextDate;
    if (this.startDate > this.endDate) {
      this.endDate = new Date(this.startDate);
    }
    this.loadJobs();
  }

  public onEndDateChange(event: any): void {
    const nextDate = event?.value instanceof Date ? event.value : this.endDate;
    this.endDate = nextDate;
    if (this.endDate < this.startDate) {
      this.startDate = new Date(this.endDate);
    }
    this.loadJobs();
  }

  public refreshJobs(): void {
    this.loadJobs();
  }

  public onPullToRefresh(event: any): void {
    const listView = event?.object;
    this.loadJobs(() => {
      listView?.notifyPullToRefreshFinished?.();
      listView?.scrollToIndex?.(0, false);
    });
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

  private loadJobs(onFinished?: () => void): void {
    if (this.isSyncing) {
      onFinished?.();
      return;
    }

    this.isSyncing = true;
    this.cdr.detectChanges();

    const startDate = this.formatDateParam(this.startOfDay(this.startDate));
    const endDate = this.formatDateParam(this.endOfDay(this.endDate));
    const userId = Number(this.user?.userId || 0);

    this.settingsService.findJobsByUser(userId, startDate, endDate).subscribe({
      next: (res) => {
        const jobs = this.normalizeJobsResponse(res);
        this.applyJobsForDisplay(jobs);
      },
      error: () => {
        this.applyJobsForDisplay([]);
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

  private applyJobsForDisplay(jobs: any[]): void {
    const normalizedJobs = jobs
      .map((job) => ({
        ...job,
        amount: Number(job?.amount || 0),
      }))
      .sort((a, b) => {
        const aTime = new Date(a?.timeSlotStartDateTime || a?.createdAt || 0).getTime();
        const bTime = new Date(b?.timeSlotStartDateTime || b?.createdAt || 0).getTime();
        return bTime - aTime;
      });

    this.jobList = new ObservableArray(normalizedJobs);
    this.totalAmount = this.usersService.isDemoUser(this.user)
      ? this.demoWeeklyTotal
      : normalizedJobs.reduce((sum, job) => sum + Number(job?.amount || 0), 0);
  }

  private normalizeJobsResponse(response: any): any[] {
    if (this.usersService.isDemoUser(this.user)) {
      return this.filterDemoJobsByDateRange();
    }

    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.payload)) {
      return response.payload;
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
