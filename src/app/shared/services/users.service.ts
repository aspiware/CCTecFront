import { Injectable } from "@angular/core";
import { UserModel } from "../models/user.model";
import {
  getBoolean,
  setBoolean,
  getNumber,
  setNumber,
  getString,
  setString,
  hasKey,
  remove,
  clear
} from "@nativescript/core/application-settings";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";



@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private user: UserModel;
  
  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService
  ) { }

  public setUser(user: UserModel): void {
    this.user = user;
  }

  public getUser(): UserModel | null {
    const raw = getString("user", "");
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as UserModel;
    } catch {
      return null;
    }
  }

  public isDemoUser(user?: Partial<UserModel> | null): boolean {
    const candidate = (user || this.getUser() || {}) as any;
    const username = String(candidate?.username || candidate?.bp || candidate?.name || '').trim().toLowerCase();
    return username === 'demo';
  }

  public buildDemoUser(): UserModel {
    return {
      userId: 999999,
      roleId: 2,
      settingId: 999999,
      name: 'Demo',
      lastname: 'Reviewer',
      token: 'demo-token',
      bp: 'demo',
      username: 'demo',
    } as UserModel;
  }

  public findById(userId: number): Observable<any> {
    return this.httpClient.get<any>(
      this.configService.getUrlBase() + `/auth/findUserById/${userId}`
    );
  }
}
