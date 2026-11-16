import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Page } from '@nativescript/core';

@Component({
  standalone: true,
  selector: 'app-ezee-home',
  imports: [NativeScriptCommonModule, CommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: '../../../summary/summary.component.html',
  styleUrl: '../../../summary/summary.component.scss',
})
export class EzeeHomeComponent implements OnInit, OnDestroy {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSyncing = false;
  public weekAverage: any = {
    totalsPerDay: [],
    dailyAverage: 0,
    todayHourlyAverage: 0,
  };
  public summaryAmount: any = {
    startDate: new Date(),
    endDate: new Date(),
    gross: 0,
    meterRent: 0,
    billingPlatform: 0,
    carRentalAmount: 0,
    toolRentalAmount: 0,
    net: 0,
  };
  private appearanceChangedHandler?: () => void;

  public constructor(
    private cdr: ChangeDetectorRef,
    private page: Page
  ) {}

  public ngOnInit(): void {
    this.syncTheme();
    this.initializeCurrentWeek();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
  }

  public ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onSummaryDirectRefresh(): void {
    this.isSyncing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.initializeCurrentWeek();
      this.isSyncing = false;
      this.cdr.detectChanges();
    }, 250);
  }

  public formatMinus(value: number): string {
    return value ? `-${value}` : '0.00';
  }

  private initializeCurrentWeek(): void {
    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(12, 0, 0, 0);

    this.weekAverage = {
      totalsPerDay: Array.from({ length: 5 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return { date, total: 0 };
      }),
      dailyAverage: 0,
      todayHourlyAverage: 0,
    };

    this.summaryAmount = {
      ...this.summaryAmount,
      startDate: monday,
      endDate: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4, 12),
    };
  }

  private syncTheme(): void {
    const appearance = Application.systemAppearance();
    if (appearance === 'dark' || appearance === 'light') {
      this.isDarkTheme = appearance === 'dark';
      return;
    }
    this.isDarkTheme = String(this.page.className || '').includes('ns-dark');
  }
}
