export class SettingModel {
  public userId?: number;
  public meterRentAmount?: number = 0;
  public penguinDataAmount?: number = 0;
  public fundWeeks?: number = 0;
  public payday: number = 0;
  public paymentFrequency: number = 0;

  constructor(setting?: Partial<SettingModel>) {
    Object.assign(this, setting);
  }
}

