import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) {}

  public login(username, password): Observable<any> {
    return this.httpClient.post<void>(
      this.configService.getUrlBase() + "/auth/signin",
      { username, password }
    );
  }

  public authorize(username, password, authMethodId): Observable<any> {
    return this.httpClient.post<void>(
      this.configService.getUrlBase() + "/auth/authorize",
      { username, password, authMethodId }
    );
  }

  public authorizeXMNoPass(userId, authMethodId): Observable<any> {
    return this.httpClient.post<void>(
      this.configService.getUrlBase() + "/auth/authorizeXMNoPass",
      { userId, authMethodId }
    );
  }

  public signup(username, password, accessToken, refreshToken, idToken): Observable<any> {
    return this.httpClient.post<void>(
      this.configService.getUrlBase() + "/auth/signup",
      { username, password, accessToken, refreshToken, idToken}
    );
  }

  public validateCode(response, code): Observable<any> {
    console.log('CODEEE', code)
    return this.httpClient.post<void>(
      `${this.configService.getUrlBase()}/auth/validateCode`,
      { ...response, code }
    );
  }

  public validateCodeXM(response, code): Observable<any> {
    console.log('CODEEE', code)
    return this.httpClient.post<void>(
      `${this.configService.getUrlBase()}/auth/validateCodeXM`,
      { ...response, code }
    );
  }
}