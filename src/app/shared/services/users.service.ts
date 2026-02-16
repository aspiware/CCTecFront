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



@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private user: UserModel;
  constructor() {}

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
}
