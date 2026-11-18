import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { File, Http, knownFolders, path } from '@nativescript/core';
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

  public downloadCurrentWeekOrdersReport(): Promise<File> {
    const token = getString('token', '');
    return Http.request({
      url: `${this.configService.getUrlBase()}/ezee-fiber/orders/export`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      timeout: 60000,
    }).then((response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        let message = 'Unable to download the weekly report.';
        try {
          const errorBody = response.content?.toJSON();
          message = String(errorBody?.message || message);
        } catch {
          // Keep the default message when the error body is not JSON.
        }
        throw new Error(message);
      }

      if (!response.content) {
        throw new Error('The weekly report response was empty.');
      }

      const contentDisposition = this.getHeader(response.headers, 'content-disposition');
      const fileName = this.getDownloadFileName(contentDisposition);
      const destinationPath = path.join(knownFolders.temp().path, fileName);
      return response.content.toFile(destinationPath);
    });
  }

  private getHeader(headers: Record<string, string | string[]>, name: string): string {
    const headerKey = Object.keys(headers || {}).find(
      (key) => key.toLowerCase() === name.toLowerCase()
    );
    const value = headerKey ? headers[headerKey] : '';
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  }

  private getDownloadFileName(contentDisposition: string): string {
    const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    const regularMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    let fileName = encodedMatch?.[1] || regularMatch?.[1] || 'ezee-orders-current-week.xlsx';
    try {
      fileName = decodeURIComponent(fileName.trim());
    } catch {
      fileName = fileName.trim();
    }

    fileName = fileName.replace(/[\\/:*?"<>|\r\n]/g, '_');
    return fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  }
}
