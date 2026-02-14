import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

type TotalsPerDayItem = {
  dayName: string;
  total: string;
};

@Component({
  standalone: true,
  selector: 'app-summary',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss',
})
export class SummaryComponent {
  protected paymentRange = 'Next Payment (Feb 10, 2026 - Feb 16, 2026)';

  protected summaryAmount = {
    gross: '$2,250.00',
    meterRent: '-$120.00',
    billingPlatform: '-$55.00',
    carRentalAmount: '-$80.00',
    toolRentalAmount: '-$25.00',
    net: '$1,970.00',
  };

  protected weekAverage = {
    totalsPerDay: [
      { dayName: 'Monday', total: '$340.00' },
      { dayName: 'Tuesday', total: '$410.00' },
      { dayName: 'Wednesday', total: '$355.00' },
      { dayName: 'Thursday', total: '$390.00' },
      { dayName: 'Friday', total: '$475.00' },
    ] as TotalsPerDayItem[],
    dailyAverage: '$394.00',
    todayHourlyAverage: '$35.82',
  };

  protected onSyncSummary(): void {
    console.log('Summary sync placeholder');
  }
}
