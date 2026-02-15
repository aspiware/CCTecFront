import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getNumber, getString } from '@nativescript/core/application-settings';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type TodayJob = {
  number: string;
  jobDescription: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  amount: number;
  status: 'OPEN' | 'CLOSED';
  isCurrent?: boolean;
  isStarred?: boolean;
  jobUnits?: number;
};

@Injectable({ providedIn: 'root' })
export class TodayService {
  constructor(private http: HttpClient) {}

  getCurrentUserId(): number {
    return getNumber('userId', 0);
  }

  findTodayByUser(userId: number): Observable<TodayJob[]> {
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl || userId <= 0) {
      return of(this.getMockJobs());
    }

    return this.http
      .get<TodayJob[]>(`${baseUrl}/jobs/findTodayByUser/${userId}`)
      .pipe(catchError(() => of(this.getMockJobs())));
  }

  getTotalCurrentWeek(userId: number): Observable<number> {
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl || userId <= 0) {
      return of(1970);
    }

    return this.http
      .get<number>(`${baseUrl}/jobs/getTotalCurrentWeek/${userId}`)
      .pipe(catchError(() => of(1970)));
  }

  private getApiBaseUrl(): string {
    return getString('apiBaseUrl', '').trim().replace(/\/+$/, '');
  }

  private getMockJobs(): TodayJob[] {
    return [
      {
        number: 'WO-1001',
        jobDescription: 'Install',
        description: 'X1',
        address: '123 Main St',
        city: 'Miami',
        state: 'FL',
        zipcode: '33101',
        amount: 240,
        status: 'OPEN',
        isCurrent: true,
        isStarred: false,
        jobUnits: 2,
      },
      {
        number: 'WO-1002',
        jobDescription: 'Troubleshoot',
        description: 'Internet',
        address: '450 Oak Ave',
        city: 'Miami',
        state: 'FL',
        zipcode: '33155',
        amount: 180,
        status: 'OPEN',
        isCurrent: false,
        isStarred: true,
        jobUnits: 1,
      },
      {
        number: 'WO-1003',
        jobDescription: 'Replace',
        description: 'Modem',
        address: '88 Palm Dr',
        city: 'Hialeah',
        state: 'FL',
        zipcode: '33012',
        amount: 320,
        status: 'CLOSED',
        isCurrent: false,
        isStarred: false,
        jobUnits: 3,
      },
    ];
  }
}
