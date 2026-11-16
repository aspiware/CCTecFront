export class UserModel {
  public id?: number;
  public userId?: number;
  public roleId?: number;
  public settingId?: number;
  public name?: string;
  public lastname?: string;
  public techNumber?: number;
  public techCode?: string;
  public active?: number | boolean;
  public token?: string;

  constructor(user?: Partial<UserModel>) {
    Object.assign(this, user);
  }
}
