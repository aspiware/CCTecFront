import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { finalize } from 'rxjs/operators';
import { action, alert } from '@nativescript/core';
import { TodayJob, TodayService } from './today.service';

@Component({
  standalone: true,
  selector: 'app-today',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss',
})
export class TodayComponent {
  protected isLoading = false;
  protected showStarred = false;
  protected jobList: TodayJob[] = [];
  protected originalJobList: TodayJob[] = [];
  protected todayTotal = 0;
  protected weeklyTotal = 0;
  protected units = 0;
  protected selectedJob: TodayJob | null = null;

  constructor(private todayService: TodayService) {
    this.syncTap();
  }

  protected syncTap(): void {
    const userId = this.todayService.getCurrentUserId();
    this.isLoading = true;

    this.todayService.findTodayByUser(userId).subscribe((jobs) => {
      this.originalJobList = (jobs || []).map((item) => ({
        ...item,
        isStarred: !!item.isStarred,
      }));
      this.applyFilters();
      this.computeTodayTotals();
    });

    this.todayService
      .getTotalCurrentWeek(userId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe((weekly) => {
        this.weeklyTotal = Number(weekly || 0);
      });
  }

  protected toggleStarredView(): void {
    this.showStarred = !this.showStarred;
    this.applyFilters();
  }

  protected setStarred(item: TodayJob): void {
    item.isStarred = !item.isStarred;
    this.originalJobList = this.originalJobList.map((job) =>
      job.number === item.number ? { ...job, isStarred: item.isStarred } : job,
    );
    this.applyFilters();
  }

  protected onItemTap(item: TodayJob): void {
    this.selectedJob = item;
    this.showJobDetails(item);
  }

  protected async openJobMenu(item: TodayJob): Promise<void> {
    const choice = await action(`Job ${item.number}`, 'Cancel', [
      'Details',
      item.isStarred ? 'Unstar' : 'Star',
      item.status === 'OPEN' ? 'Mark Closed' : 'Mark Open',
    ]);

    if (choice === 'Details') {
      this.showJobDetails(item);
      return;
    }

    if (choice === 'Star' || choice === 'Unstar') {
      this.setStarred(item);
      return;
    }

    if (choice === 'Mark Closed' || choice === 'Mark Open') {
      const newStatus = item.status === 'OPEN' ? 'CLOSED' : 'OPEN';
      this.updateJobStatus(item, newStatus);
    }
  }

  protected currency(value: number): string {
    const num = Number(value || 0);
    return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  protected formatJobTitle(item: TodayJob): string {
    return `${item.jobDescription}${item.description ? ' - ' + item.description : ''}`;
  }

  protected formatAddress(item: TodayJob): string {
    return `${item.address}, ${item.city}, ${item.state} ${item.zipcode}`;
  }

  private showJobDetails(item: TodayJob): void {
    void alert({
      title: `${item.jobDescription}`,
      message: [
        `Job: ${item.number}`,
        `Status: ${item.status}`,
        `Amount: ${this.currency(item.amount)}`,
        `Address: ${this.formatAddress(item)}`,
      ].join('\n'),
      okButtonText: 'OK',
    });
  }

  private updateJobStatus(item: TodayJob, status: 'OPEN' | 'CLOSED'): void {
    this.originalJobList = this.originalJobList.map((job) =>
      job.number === item.number ? { ...job, status } : job,
    );
    this.applyFilters();
  }

  private applyFilters(): void {
    this.jobList = this.showStarred
      ? this.originalJobList.filter((item) => item.isStarred)
      : [...this.originalJobList];
    this.computeTodayTotals();
  }

  private computeTodayTotals(): void {
    this.todayTotal = this.jobList.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    this.units = this.jobList.reduce((acc, item) => acc + Number(item.jobUnits || 0), 0);
  }
}
