import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getNumber } from '@nativescript/core/application-settings';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from '../shared/services/config.service';

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
  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) { }

  public getNextPayment(userId: number): Observable<any> {
    return this.httpClient.get<string>(
      this.configService.getUrlBase() + `/jobs/getNextPayment/${userId}`
    );
  }

  public getWeekAverage(userId: number): Observable<any> {
    return this.httpClient.get<string>(
      this.configService.getUrlBase() + `/jobs/getWeekAverage/${userId}`
    );
  }

}
