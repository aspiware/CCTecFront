import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { finalize } from 'rxjs/operators';
import { SummaryService } from './summary.service';

type TotalsPerDayItem = { date: string; total: number };

@Component({
  standalone: true,
  selector: 'app-summary',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss',
})
export class SummaryComponent {
  protected isLoading = false;

  protected summaryAmount = {
    startDate: '2026-02-10',
    endDate: '2026-02-16',
    gross: 0,
    meterRent: 0,
    billingPlatform: 0,
    carRentalAmount: 0,
    toolRentalAmount: 0,
    net: 0,
  };

  protected weekAverage = {
    totalsPerDay: [] as TotalsPerDayItem[],
    dailyAverage: 0,
    todayHourlyAverage: 0,
  };

  constructor(private summaryService: SummaryService) {
    this.syncSummary();
  }

  protected syncSummary(): void {
    const userId = this.summaryService.getCurrentUserId();
    this.isLoading = true;

    this.summaryService.getNextPayment(userId).subscribe((res) => {
      this.summaryAmount = res;
    });

    this.summaryService
      .getWeekAverage(userId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe((res) => {
        const list = Array.isArray(res.totalsPerDay) ? res.totalsPerDay : [];
        const total = list.reduce((acc, item) => acc + Number(item.total || 0), 0);
        this.weekAverage = {
          totalsPerDay: list,
          dailyAverage: list.length ? total / list.length : 0,
          todayHourlyAverage: res.todayHourlyAverage || 0,
        };
      });
  }

  protected formatMinusCurrency(value: number): string {
    if (!value) {
      return '$0.00';
    }
    return `-${this.currency(value)}`;
  }

  protected currency(value: number): string {
    const num = Number(value || 0);
    return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}
