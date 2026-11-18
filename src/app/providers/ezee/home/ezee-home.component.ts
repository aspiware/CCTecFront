import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Page, Utils, alert, isIOS } from '@nativescript/core';
import { forkJoin, Subscription } from 'rxjs';
import { EzeeDailyTotal, EzeeSummaryService } from './ezee-summary.service';

@Component({
  standalone: true,
  selector: 'app-ezee-home',
  imports: [NativeScriptCommonModule, CommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: '../../../summary/summary.component.html',
  styleUrl: '../../../summary/summary.component.scss',
})
export class EzeeHomeComponent implements OnInit, OnDestroy {
  public showWeeklyReportExport = true;
  public isExportingWeeklyReport = false;
  public showMeterRentalAmount = false;
  public showBillingPlatform = false;
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
  private summarySubscription?: Subscription;

  public constructor(
    private cdr: ChangeDetectorRef,
    private page: Page,
    private summaryService: EzeeSummaryService
  ) {}

  public ngOnInit(): void {
    this.syncTheme();
    this.loadCurrentWeek();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
  }

  public ngOnDestroy(): void {
    this.summarySubscription?.unsubscribe();
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onSummaryDirectRefresh(): void {
    this.loadCurrentWeek(true);
  }

  public async onWeeklyReportExport(): Promise<void> {
    if (this.isExportingWeeklyReport) {
      return;
    }

    this.isExportingWeeklyReport = true;
    this.cdr.detectChanges();
    try {
      const report = await this.summaryService.downloadCurrentWeekOrdersReport();
      this.openWeeklyReport(report.path);
    } catch (error: any) {
      const message = String(
        error?.error?.message || error?.message || 'Unable to download the weekly report.'
      );
      await alert({
        title: 'Export Weekly Report',
        message,
        okButtonText: 'OK',
      });
    } finally {
      this.isExportingWeeklyReport = false;
      this.cdr.detectChanges();
    }
  }

  public formatMinus(value: number): string {
    return value ? `-${value}` : '0.00';
  }

  private loadCurrentWeek(forceRefresh = false): void {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    this.cdr.detectChanges();
    this.summarySubscription?.unsubscribe();
    this.summarySubscription = forkJoin({
      weekly: this.summaryService.getCurrentWeek(forceRefresh),
      nextPayment: this.summaryService.getNextPayment(),
    }).subscribe({
      next: ({ weekly, nextPayment }) => {
        if (weekly?.error || nextPayment?.error) {
          this.showSummaryError(
            weekly?.error
              ? weekly.message || 'Unable to load the weekly summary.'
              : nextPayment?.message || 'Unable to load the next payment.'
          );
          return;
        }

        const weeklyData = weekly?.data;
        const totalsPerDay = (
          Array.isArray(weeklyData?.totalsPerDay) ? weeklyData.totalsPerDay : []
        ).map(
          (item) => ({
            date: String(item?.date || ''),
            total: Number(item?.total || 0),
          })
        );

        this.weekAverage = {
          totalsPerDay,
          dailyAverage: this.calculateDailyAverage(totalsPerDay),
          todayHourlyAverage: this.calculateTodayHourlyAverage(totalsPerDay),
        };
        const payment = nextPayment?.data;
        const gross = Number(payment?.gross || 0);
        const net = Number(payment?.net ?? 0);
        const carRentalAmount = Number(payment?.carRentalAmount || 0);
        const toolRentalAmount = Number(payment?.toolRentalAmount || 0);
        this.summaryAmount = {
          startDate: this.parseLocalDate(payment?.startDate),
          endDate: this.parseLocalDate(payment?.endDate),
          paymentDate: this.parseLocalDate(payment?.paymentDate),
          gross,
          meterRent: 0,
          billingPlatform: 0,
          carRentalAmount,
          toolRentalAmount,
          net,
        };
      },
      error: (error) => {
        const message = String(
          error?.error?.message || error?.message || 'Unable to load the weekly summary.'
        );
        this.showSummaryError(message);
      },
      complete: () => {
        this.finishSync();
      },
    });
  }

  private calculateDailyAverage(totals: EzeeDailyTotal[]): number {
    return totals.length
      ? totals.reduce((sum, item) => sum + Number(item.total || 0), 0) / totals.length
      : 0;
  }

  private calculateTodayHourlyAverage(totals: EzeeDailyTotal[]): number {
    const todayKey = this.toDateKey(new Date());
    const todayTotal = Number(totals.find((item) => item.date === todayKey)?.total || 0);
    if (!todayTotal) {
      return 0;
    }

    const now = new Date();
    const start = new Date(now);
    start.setHours(8, 0, 0, 0);
    const end = new Date(now);
    end.setHours(18, 30, 0, 0);
    if (now <= start) {
      return 0;
    }

    const effectiveEnd = now < end ? now : end;
    const elapsedHours = (effectiveEnd.getTime() - start.getTime()) / 3600000;
    return elapsedHours > 0 ? todayTotal / elapsedHours : 0;
  }

  private parseLocalDate(value: string | undefined): Date {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return new Date(value || '');
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private showSummaryError(message: string): void {
    this.finishSync();
    alert({
      title: 'Unable to Load Summary',
      message,
      okButtonText: 'OK',
    });
  }

  private finishSync(): void {
    this.isSyncing = false;
    this.cdr.detectChanges();
  }

  private openWeeklyReport(filePath: string): void {
    if (isIOS) {
      const visibleViewController = this.getVisibleViewController();
      if (visibleViewController) {
        const fileUrl = NSURL.fileURLWithPath(filePath);
        const activityController = UIActivityViewController.alloc()
          .initWithActivityItemsApplicationActivities([fileUrl], []);
        const popover = activityController.popoverPresentationController;
        if (popover) {
          popover.sourceView = visibleViewController.view;
          popover.sourceRect = CGRectMake(
            visibleViewController.view.bounds.size.width / 2,
            visibleViewController.view.bounds.size.height / 2,
            1,
            1
          );
          popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
        }
        visibleViewController.presentViewControllerAnimatedCompletion(
          activityController,
          true,
          null
        );
        return;
      }
    }

    if (!Utils.openFile(filePath, 'Open Weekly Report')) {
      throw new Error('Unable to open the downloaded weekly report.');
    }
  }

  private getVisibleViewController(): UIViewController | null {
    if (!isIOS) {
      return null;
    }
    const sharedApplication = UIApplication.sharedApplication;
    const keyWindow = sharedApplication.keyWindow ||
      (sharedApplication.windows?.count ? sharedApplication.windows.objectAtIndex(0) : null);
    const rootViewController = keyWindow?.rootViewController;
    return rootViewController ? Utils.ios.getVisibleViewController(rootViewController) : null;
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
