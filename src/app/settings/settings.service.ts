import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';
import { SettingModel } from './setting.model';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  public settingList: SettingModel[];
  public asd: string = '123';

  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) {
    this.settingList = null;
  }

  public getJobList(): SettingModel[] {
    return this.settingList;
  }

  public setJobList(settingList: SettingModel[]) {
    return (this.settingList = settingList);
  }

  public create(settingList: SettingModel): Observable<any> {
    return this.httpClient.post<void>(
      this.configService.getUrlBase() + '/settings/create',
      settingList
    );
  }

  public update(id: number, settings: any): Observable<any> {
    return this.httpClient.put<void>(
      `${this.configService.getUrlBase()}/settings/update/${id}`,
      settings
    );
  }

  public findByUser(userId: number): Observable<any> {
    return this.httpClient.get<any>(
      this.configService.getUrlBase() + `/settings/findByUser/${userId}`
    );
  }

  public updateModemBoxPrices(userId: number, modemPrice: number, boxPrice: number): Observable<any> {
    return this.httpClient.post<any>(
      this.configService.getUrlBase() + '/settings/updateModemBoxPrices',
      { userId, modemPrice, boxPrice }
    );
  }

  public updateXHEquipmentPrices(
    userId: number,
    sensorPrice: number,
    cameraPrice: number,
    xhPanelPrice: number
  ): Observable<any> {
    return this.httpClient.post<any>(
      this.configService.getUrlBase() + '/settings/updateXHEquipmentPrices',
      { userId, sensorPrice, cameraPrice, xhPanelPrice }
    );
  }

  public updateTexts(settings: any): Observable<any> {
    return this.httpClient.put<any>(
      this.configService.getUrlBase() + '/settings/updateTexts',
      settings
    );
  }

  public updateBillingData(settings: any): Observable<any> {
    return this.httpClient.put<any>(
      this.configService.getUrlBase() + '/settings/updateBillingData',
      settings
    );
  }

  public findPerDay(
    userId: number,
    starDate: string,
    endDate: string
  ): Observable<any> {
    return this.httpClient.get<any>(
      encodeURI(
        this.configService.getUrlBase() +
        `/jobs/findPerDay/${userId}/${starDate}/${endDate}`
      )
    );
  }
}
