import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getString } from '@nativescript/core/application-settings';
import { Observable, timeout } from 'rxjs';
import { ConfigService } from '../../../shared/services/config.service';

export interface EzeePayrollSettingsResponse {
  statusCode: number;
  message: string;
  error: boolean;
  data: {
    fundWeeks: number;
    payday: number | null;
    carRentalAmount: number;
    toolRentalAmount: number;
  };
}

export interface EzeePayrollSettingsUpdate {
  fundWeeks: number;
  payday: number | null;
  carRentalAmount: number;
  toolRentalAmount: number;
}

@Injectable({ providedIn: 'root' })
export class EzeePayrollService {
  public constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) {}

  public getPayrollSettings(): Observable<EzeePayrollSettingsResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.httpClient.get<EzeePayrollSettingsResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/settings/payroll`,
      { headers }
    ).pipe(timeout(20000));
  }

  public updatePayrollSettings(
    settings: EzeePayrollSettingsUpdate
  ): Observable<EzeePayrollSettingsResponse> {
    const token = getString('token', '');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.httpClient.patch<EzeePayrollSettingsResponse>(
      `${this.configService.getUrlBase()}/ezee-fiber/settings/payroll`,
      settings,
      { headers }
    ).pipe(timeout(20000));
  }
}
