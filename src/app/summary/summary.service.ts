import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getNumber, getString } from '@nativescript/core/application-settings';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type NextPayment = {
  startDate: string;
  endDate: string;
  gross: number;
  meterRent: number;
  billingPlatform: number;
  carRentalAmount: number;
  toolRentalAmount: number;
  net: number;
};

export type WeekAverage = {
  totalsPerDay: Array<{ date: string; total: number }>;
  dailyAverage?: number;
  todayHourlyAverage?: number;
};

@Injectable({ providedIn: 'root' })
export class SummaryService {
  constructor(private http: HttpClient) {}

  getCurrentUserId(): number {
    return getNumber('userId', 0);
  }

  getNextPayment(userId: number): Observable<NextPayment> {
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl || userId <= 0) {
      return of(this.getMockNextPayment());
    }

    return this.http
      .get<NextPayment>(`${baseUrl}/jobs/getNextPayment/${userId}`)
      .pipe(catchError(() => of(this.getMockNextPayment())));
  }

  getWeekAverage(userId: number): Observable<WeekAverage> {
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl || userId <= 0) {
      return of(this.getMockWeekAverage());
    }

    return this.http
      .get<WeekAverage>(`${baseUrl}/jobs/getWeekAverage/${userId}`)
      .pipe(catchError(() => of(this.getMockWeekAverage())));
  }

  private getApiBaseUrl(): string {
    // Set `apiBaseUrl` in application-settings when API is ready.
    return getString('apiBaseUrl', '').trim().replace(/\/+$/, '');
  }

  private getMockNextPayment(): NextPayment {
    return {
      startDate: '2026-02-10',
      endDate: '2026-02-16',
      gross: 2250,
      meterRent: 120,
      billingPlatform: 55,
      carRentalAmount: 80,
      toolRentalAmount: 25,
      net: 1970,
    };
  }

  private getMockWeekAverage(): WeekAverage {
    return {
      totalsPerDay: [
        { date: '2026-02-09', total: 340 },
        { date: '2026-02-10', total: 410 },
        { date: '2026-02-11', total: 355 },
        { date: '2026-02-12', total: 390 },
        { date: '2026-02-13', total: 475 },
      ],
      dailyAverage: 394,
      todayHourlyAverage: 35.82,
    };
  }
}
