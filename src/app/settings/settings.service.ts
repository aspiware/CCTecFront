import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';
import { SettingModel } from './setting.model';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  public settingList: SettingModel[];
  public asd: string = '123';

  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService,
    private usersService: UsersService
  ) {
    this.settingList = null;
  }

  private demoSettings: any = {
    id: 999999,
    userId: 999999,
    meterRentAmount: 12.5,
    billingPlatformAmount: 8,
    carRentalAmount: 55,
    toolRentalAmount: 18,
    fundWeeks: 2,
    payday: 4,
    englishSurveyText: 'Thanks for choosing CCTec. Please rate your service today.',
    spanishSurveyText: 'Gracias por elegir CCTec. Por favor califique su servicio de hoy.',
    englishAvailabilityText: 'Your technician is on the way and will arrive during the scheduled window.',
    spanishAvailabilityText: 'Su tecnico va en camino y llegara durante la ventana programada.',
  };

  private isDemoUser(): boolean {
    return this.usersService.isDemoUser();
  }

  public getJobList(): SettingModel[] {
    return this.settingList;
  }

  public setJobList(settingList: SettingModel[]) {
    return (this.settingList = settingList);
  }

  public create(settingList: SettingModel): Observable<any> {
    if (this.isDemoUser()) {
      this.demoSettings = { ...this.demoSettings, ...settingList };
      return of(this.demoSettings);
    }
    return this.httpClient.post<void>(
      this.configService.getUrlBase() + '/settings/create',
      settingList
    );
  }

  public update(id: number, settings: any): Observable<any> {
    if (this.isDemoUser()) {
      this.demoSettings = { ...this.demoSettings, id, ...settings };
      return of(this.demoSettings);
    }
    return this.httpClient.put<void>(
      `${this.configService.getUrlBase()}/settings/update/${id}`,
      settings
    );
  }

  public findByUser(userId: number): Observable<any> {
    if (this.isDemoUser()) {
      return of({ ...this.demoSettings, userId });
    }
    return this.httpClient.get<any>(
      this.configService.getUrlBase() + `/settings/findByUser/${userId}`
    );
  }

  public updateModemBoxPrices(userId: number, modemPrice: number, boxPrice: number): Observable<any> {
    if (this.isDemoUser()) {
      this.demoSettings = { ...this.demoSettings, userId, modemPrice, boxPrice };
      return of(this.demoSettings);
    }
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
    if (this.isDemoUser()) {
      this.demoSettings = { ...this.demoSettings, userId, sensorPrice, cameraPrice, xhPanelPrice };
      return of(this.demoSettings);
    }
    return this.httpClient.post<any>(
      this.configService.getUrlBase() + '/settings/updateXHEquipmentPrices',
      { userId, sensorPrice, cameraPrice, xhPanelPrice }
    );
  }

  public updateTexts(settings: any): Observable<any> {
    if (this.isDemoUser()) {
      this.demoSettings = { ...this.demoSettings, ...settings };
      return of(this.demoSettings);
    }
    return this.httpClient.put<any>(
      this.configService.getUrlBase() + '/settings/updateTexts',
      settings
    );
  }

  public updateBillingData(settings: any): Observable<any> {
    if (this.isDemoUser()) {
      this.demoSettings = { ...this.demoSettings, ...settings };
      return of(this.demoSettings);
    }
    return this.httpClient.put<any>(
      this.configService.getUrlBase() + '/settings/updateBillingData',
      settings
    );
  }

  public findJobsByUser(
    userId: number,
    starDate: string,
    endDate: string
  ): Observable<any> {
    if (this.isDemoUser()) {
      return of([]);
    }
    return this.httpClient.get<any>(
      encodeURI(
        this.configService.getUrlBase() +
        `/jobs/findByUser/${userId}/${starDate}/${endDate}`
      )
    );
  }

  public saveJobTypePrice(prices: any[]): Observable<any> {
    if (this.isDemoUser()) {
      return of(prices);
    }
    return this.httpClient.post<void>(
      this.configService.getUrlBase() + "/jobs/saveJobTypePrice",
      prices
    );
  }

  public deleteAccount(userId: number): Observable<any> {
    if (this.isDemoUser()) {
      return of({ success: true });
    }
    return this.httpClient.put<void>(
      `${this.configService.getUrlBase()}/auth/deleteAccount/${userId}`, null
    );
  }
}
