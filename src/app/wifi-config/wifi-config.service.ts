import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';

@Injectable({ providedIn: 'root' })
export class WifiConfigService {
  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) {}

  public getWifiConfig(
    userId: number,
    accountNumber: number | string,
    workOrderNumber: number | string,
    gatewayMac: string,
    serialNumber: string
  ): Observable<any> {
    return this.httpClient.get<any>(
      `${this.configService.getUrlBase()}/jobs/c/getWifiConfig/${userId}/${accountNumber}/${workOrderNumber}/${gatewayMac}/${serialNumber}`
    );
  }

  public updateWifiConfig(
    userId: number,
    accountNumber: number | string,
    workOrderNumber: number | string,
    serialNumber: string,
    wifiConfig: any
  ): Observable<any> {
    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/jobs/c/updateWifiConfig/${userId}/${accountNumber}/${workOrderNumber}/${serialNumber}`,
      wifiConfig
    );
  }

  public gatewayStatus(
    userId: number,
    cmMac: string,
    workOrderNumber: number | string,
    accountNumber: number | string
  ): Observable<any> {
    return this.httpClient.get<any>(
      `${this.configService.getUrlBase()}/jobs/c/gatewayStatus/${userId}/${cmMac}/${workOrderNumber}/${accountNumber}`
    );
  }
}
