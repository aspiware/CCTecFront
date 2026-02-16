import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';

@Injectable({ providedIn: 'root' })
export class TodayService {
  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) {}

  public findTodayByUser(userId: number): Observable<any> {
    return this.httpClient.get<any>(
      `${this.configService.getUrlBase()}/jobs/findTodayByUser/${userId}`
    );
  }

  public getTotalCurrentWeek(userId: number): Observable<any> {
    return this.httpClient.get<any>(
      `${this.configService.getUrlBase()}/jobs/getTotalCurrentWeek/${userId}`
    );
  }

  public hasLunch(userId: number): Observable<any> {
    return this.httpClient.post<any>(
      `${this.configService.getUrlBase()}/jobs/c/hasLunch`,
      { userId }
    );
  }

  public getTechStatus(userId: number): Observable<any> {
    return this.httpClient.get<any>(
      `${this.configService.getUrlBase()}/jobs/c/getTechStatus/${userId}`
    );
  }

  public update(job: any): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/update`,
      job
    );
  }

  public updateCustomJob(job: any): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/updateCustomJob`,
      job
    );
  }

  public delete(id: number): Observable<any> {
    return this.httpClient.delete<any>(
      `${this.configService.getUrlBase()}/jobs/delete/${id}`
    );
  }

  public saveResolCodes(
    userId: number,
    workOrderId: number | string,
    codeList: any
  ): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/c/saveResolCodes/${userId}/${workOrderId}`,
      codeList
    );
  }

  public resolCodes(
    userId: number,
    workOrderId: number | string
  ): Observable<any> {
    return this.httpClient.get<any>(
      `${this.configService.getUrlBase()}/jobs/c/resolCodes/${userId}/${workOrderId}`
    );
  }

  public completeJob(
    userId: number,
    workOrderId: number | string
  ): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/c/completeJob/${userId}/${workOrderId}`,
      null
    );
  }

  public selectJob(
    userId: number,
    workOrderNumber: number | string
  ): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/c/selectJob/${userId}/${workOrderNumber}`,
      null
    );
  }

  public updateLocation(userId: number, data: any): Observable<any> {
    return this.httpClient.post<any>(
      `${this.configService.getUrlBase()}/jobs/c/updateLocation/${userId}`,
      data
    );
  }

  public updateTechStatus(
    userId: number,
    accountNumber: number | string,
    workOrderNumber: number | string,
    techStatus: string,
    techLocation: any
  ): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/c/updateTechStatus/${userId}/${accountNumber}/${workOrderNumber}/${techStatus}`,
      techLocation
    );
  }

  public updateTechStatusMenu(
    userId: number,
    techStatus: string,
    lastKnownTechStatus: string
  ): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/c/updateTechStatusMenu/${userId}/${techStatus}/${lastKnownTechStatus}`,
      null
    );
  }

  public updateEtc(
    userId: number,
    workOrderNumber: number | string,
    timestamp: number
  ): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/c/updateEtc/${userId}/${workOrderNumber}/${timestamp}`,
      null
    );
  }
}
