import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getString } from '@nativescript/core/application-settings';
import { finalize, Observable, of, shareReplay, tap, timeout } from 'rxjs';
import { ConfigService } from '../../../shared/services/config.service';

export interface EzeeDailyTotal {
  date: string;
  total: number;
}

export interface EzeeWeeklySummaryResponse {
  statusCode: number;
  message: string;
  error: boolean;
  data: {
    startDate: string;
    endDate: string;
    weeklyTotal: number;
    totalsPerDay: EzeeDailyTotal[];
  };
}

export interface EzeeNextPaymentResponse {
  statusCode: number;
  message: string;
  error: boolean;
  data: {
    fundWeeks: number;
    payday: number | null;
    paymentDate: string;
    startDate: string;
    endDate: string;
    gross: number;
    net: number;
    carRentalAmount: number;
    toolRentalAmount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class EzeeSummaryService {
  private cachedResponse?: EzeeWeeklySummaryResponse;
  private cachedToken = '';
  private inFlightRequest?: Observable<EzeeWeeklySummaryResponse>;

  public constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) {}

  public getCurrentWeek(forceRefresh = false): Observable<EzeeWeeklySummaryResponse> {
    const token = getString('token', '');
    if (token !== this.cachedToken) {
      this.cachedToken = token;
      this.cachedResponse = undefined;
      this.inFlightRequest = undefined;
    }

    if (!forceRefresh && this.cachedResponse) {
      return of(this.cachedResponse);
    }
    if (this.inFlightRequest) {
      return this.inFlightRequest;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.inFlightRequest = this.httpClient.get<EzeeWeeklySummaryResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/summary/current-week`,
      { headers }
    ).pipe(
      timeout(20000),
      tap((response) => {
        if (!response?.error) {
          this.cachedResponse = response;
        }
      }),
      finalize(() => {
        this.inFlightRequest = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.inFlightRequest;
  }

  public getNextPayment(): Observable<EzeeNextPaymentResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.get<EzeeNextPaymentResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/summary/next-payment`,
      { headers }
    ).pipe(timeout(20000));
  }
}
