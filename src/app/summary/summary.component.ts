import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { SummaryService } from './summary.service';
import { CommonModule } from '@angular/common';
import { UsersService } from "~/app/shared/services/users.service";
import { UserModel } from '../shared/models/user.model';

@Component({
  standalone: true,
  selector: 'app-summary',
  imports: [NativeScriptCommonModule, CommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss',
})
export class SummaryComponent implements OnInit {
  public isSyncing = false;
  public user: UserModel;
  public weekAverage: any = {};
  public summaryAmount: any = {
    meterRent: 0,
    billingPlatform: 0,
    carRentalAmount: 0,
    toolRentalAmount: 0,
    net: 0
  };


  constructor(
    private usersService: UsersService,
    private summaryService: SummaryService,
    private cdr: ChangeDetectorRef
  ) {

  }

  ngOnInit(): void {
    this.user = { userId: 15 };

    this.syncSummary();
  }

  public syncSummary() {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    this.cdr.detectChanges();
    let pending = 2;
    const onDone = () => {
      pending -= 1;
      if (pending <= 0) {
        this.isSyncing = false;
      }
      this.cdr.detectChanges();
    };

    this.summaryService.getNextPayment(this.user.userId || 0).subscribe({
      next: (res) => {
        this.summaryAmount = res;
        onDone();
      },
      error: () => {
        onDone();
      },
    });

    this.summaryService.getWeekAverage(this.user.userId || 0).subscribe({
      next: (res) => {
        this.weekAverage = res;
        const list = Array.isArray(res?.totalsPerDay) ? res.totalsPerDay : [];
        this.weekAverage.dailyAverage = list.length
          ? list.reduce((total, i) => total + Number(i.total), 0) / list.length
          : 0;
        this.weekAverage.todayHourlyAverage = Number(res?.todayHourlyAverage || 0);
        this.weekAverage.totalsPerDay = list;
        onDone();
      },
      error: () => {
        onDone();
      },
    });
  }

  public onSummaryDirectRefresh(): void {
    this.syncSummary();
  }

  protected formatMinus(value: number): string {
    if (!value) {
      return '0.00';
    }
    return `-${value}`;
  }

}
