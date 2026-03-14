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
    this.totalAmount = normalizedJobs.reduce((sum, job) => sum + Number(job?.amount || 0), 0);
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
    const rawJobs = [
      ['TECH RECOVERY', '', 52.33, '101 Demo Ave Apt 1', 'Clearview', 'TX', '770010101', 'D-1001', '9900000000001001', 20, '2026-03-02T09:00:00-06:00', '2026-03-02T11:00:00-06:00', 'CLOSED'],
      ['TECH RECOVERY', '', 52.33, '202 Review St', 'Northgate', 'TX', '770020202', 'D-1002', '9900000000001002', 20, '2026-03-04T09:00:00-06:00', '2026-03-04T11:00:00-06:00', 'CLOSED'],
      ['VID UP', 'Upgrade', 44.99, '303 Sample Court', 'Lakeside', 'TX', '770030303', 'D-1003', '9900000000001003', 24, '2026-03-06T10:00:00-06:00', '2026-03-06T12:00:00-06:00', 'CLOSED'],
      ['HSD RC', 'Double Play Install', 62.72, '404 Preview Lane', 'Bayview', 'TX', '770040404', 'D-1004', '9900000000001004', 27, '2026-03-07T13:00:00-06:00', '2026-03-07T15:00:00-06:00', 'CLOSED'],
      ['TECH RECOVERY', '', 52.33, '505 Sandbox Blvd Apt 8', 'Westfield', 'TX', '770050505', 'D-1005', '9900000000001005', 20, '2026-03-09T15:00:00-06:00', '2026-03-09T17:00:00-06:00', 'CLOSED'],
      ['TECH RECOVERY', '', 52.33, '606 Review Park Dr', 'Spring Harbor', 'TX', '770060606', 'D-1006', '9900000000001006', 20, '2026-03-10T13:00:00-06:00', '2026-03-10T15:00:00-06:00', 'CLOSED'],
      ['HSD OUT', 'Trouble Call', 36.65, '707 Example Ridge', 'River Oaks', 'TX', '770070707', 'D-1007', '9900000000001007', 17, '2026-03-12T15:00:00-06:00', '2026-03-12T17:00:00-06:00', 'CLOSED'],
      ['TECH RECOVERY', '', 52.33, '808 Mockingbird Way', 'Pine Hills', 'TX', '770080808', 'D-1008', '9900000000001008', 20, '2026-03-13T08:00:00-06:00', '2026-03-13T10:00:00-06:00', 'CLOSED'],
    ];

    return rawJobs.map((job, index) => ({
      id: 30000 + index,
      jobDescription: job[0],
      description: job[1],
      amount: job[2],
      address: job[3],
      city: job[4],
      state: job[5],
      zipcode: job[6],
      number: job[7],
      accountNumber: job[8],
      jobUnits: job[9],
      timeSlotStartDateTime: job[10],
      timeSlotEndDateTime: job[11],
      status: job[12],
      isCurrent: 0,
      sms_survey_sent: index % 3 === 0,
    }));
  }
}
