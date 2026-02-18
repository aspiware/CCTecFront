import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule, NativeScriptFormsModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { getNumber } from '@nativescript/core/application-settings';
import { MenuButtonAction, MenuEvent } from '../shared/components/menu-button';
import { WifiConfigService } from './wifi-config.service';

@Component({
  standalone: true,
  selector: 'app-wifi-config',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, ReactiveFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './wifi-config.component.html',
  styleUrl: './wifi-config.component.scss',
})
export class WifiConfigComponent implements OnInit {
  public selectedIndex: number = -1;
  public expenseTypeId: number = 0;
  public code: number;
  job: any;
  devicesChanged: any[] = [];
  asd;
  private userId: number;
  private mac: string = '';
  public wifiConfigForm: FormGroup;
  public deviceOptions: any[] = [];
  public deviceLabels: string[] = [];
  private device: any;
  private configSetId: string;
  private wifiData: any;
  private wifiDataV2: any[] = [];
  public isLoading: boolean = false;
  public viewReady = false;
  public useSameForAll: boolean = true;
  public wifiBands: Array<{ label: string }> = [];
  public securityOptions: string[][] = [];
  mainMenu: Item =
    {
      name: 'Main Menu',
      options: [
        { name: 'Refresh Wi-Fi Info', icon: 'arrow.clockwise' },
        { name: 'Share Wi-Fi via SMS', icon: 'ellipsis.message' },
        {
          name: 'Save Wi-Fi Settings', icon: 'checkmark.circle', destructive: true, confirm: {
            title: 'Do you want to save the new Wi-Fi settings?',
            confirmText: 'Yes',
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };

  constructor(
    private wifiConfigService: WifiConfigService,
    private modalParams: ModalDialogParams,
    public fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.job = this.modalParams.context;

    this.wifiConfigForm = this.fb.group({
      primary: this.fb.group({
        name: [null, Validators.required],
        password: [null, Validators.required],
        security: [null, Validators.required],
      }),
      bands: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.userId = getNumber("userId", 15);

    this.deviceOptions = [];
    this.deviceLabels = [];
    this.job.devices
      .filter(d => d.type == 'MTA' || d.type == 'HSI' || d.type == 'CM')
      .forEach(device => {
        const label = device?.serialNumber || device?.deviceSerialNumber || '';
        this.deviceOptions.push(device);
        this.deviceLabels.push(label);
      });

    this.selectedIndex = 0;
    setTimeout(() => {
      this.viewReady = true;
      this.onchange({ newIndex: this.selectedIndex });
      this.cdr.detectChanges();
    }, 0);
  }

  checkedChange(event: any, item: any) {
    console.log(event.object.checked)
    console.log(item)

    if (event.object.checked) {
      this.devicesChanged.push(item.serialNumber);
    } else {
      if (this.devicesChanged.indexOf(item.serialNumber) > -1) {
        this.devicesChanged.splice(this.devicesChanged.indexOf(item.serialNumber), 1);
      }
    }

    console.log('devices-CHANGED****', this.devicesChanged);
  }

  gatewayStatus(mac: string) {
    this.mac = mac;
    this.wifiConfigService.gatewayStatus(this.userId, mac,
      this.job.workOrderNumber,
      this.job.accountNumber,).subscribe({
        next: (res) => {
          console.log(res);
          this.mac = '';
        }, error: (error) => {
          console.log(error);
          this.mac = '';
        }
      });
  }

  public updateWifiConfig() {
    this.setLoading(true);
    const payload = this.buildWifiPayload();
    this.wifiConfigService.updateWifiConfig(this.userId, this.job.accountNumber, this.job.workOrderNumber, this.device.serialNumber, payload).subscribe({
      next: (res) => {
        console.log(res);
        this.setLoading(false);

        
      }, error: (error) => {
        this.setLoading(false);
        console.log(error);
       
      }
    });
  }

  public sendWifiConfig() {
    let numbers = [];

    if (this.job.customer?.homePhoneNumber) {
      numbers.push(this.job.customer.homePhoneNumber);
    }

    if (this.job.customer?.callFirstPhoneNumber) {
      numbers.push(this.job.customer.callFirstPhoneNumber);
    }

    if (this.job.customer?.workPhoneNumber) {
      numbers.push(this.job.customer.workPhoneNumber);
    }

    const primary = this.getPrimaryForMessage();
    this.modalParams.closeCallback({
      numbers: [...new Set(numbers)],
      wifiData: `Wifi Name: ${primary.ssid}\nWifi Password: ${primary.password}`,
    });
  }

  public onUseSameChanged(event: any) {
    const checked = event?.value ?? event?.object?.checked ?? event?.checked ?? false;
    const wasSame = this.useSameForAll;
    this.useSameForAll = !!checked;

    const primary = this.wifiConfigForm.get('primary')?.value;
    if (!this.useSameForAll && wasSame) {
      this.bandsArray.controls.forEach((control) => {
        const options = this.securityOptions[this.bandsArray.controls.indexOf(control)] || [];
        const primarySecurity = primary?.security || null;
        const securityValue = primarySecurity && options.includes(primarySecurity)
          ? primarySecurity
          : (options[0] || control.get('security')?.value || null);
        control.patchValue(
          { name: primary?.name || null, password: primary?.password || null, security: securityValue },
          { emitEvent: false }
        );
      });
    }

    if (this.useSameForAll && !wasSame && this.bandsArray.length) {
      const firstBand = this.bandsArray.at(0).value;
      this.wifiConfigForm.get('primary')?.patchValue(
        { name: firstBand?.name || null, password: firstBand?.password || null, security: firstBand?.security || null },
        { emitEvent: false }
      );
    }
  }

  public get bandsControls() {
    return this.bandsArray.controls;
  }

  private get bandsArray(): FormArray {
    return this.wifiConfigForm.get('bands') as FormArray;
  }

  private setBandsForm(bands: any[]) {
    while (this.bandsArray.length) {
      this.bandsArray.removeAt(0);
    }

    bands.forEach((band) => {
      this.bandsArray.push(this.fb.group({
        name: [band?.ssid || null, Validators.required],
        password: [band?.password || null, Validators.required],
        security: [band?.security || null, Validators.required],
      }));
    });
  }

  private getBandLabel(band: any, index: number): string {
    return band?.band || band?.bandName || band?.frequency || `Band ${index + 1}`;
  }

  public bandLabel(index: number): string {
    if (this.wifiBands[index]?.label) {
      return this.wifiBands[index].label;
    }
    return index === 0 ? '2.4 GHz' : `Band ${index + 1}`;
  }

  public bandTitle(index: number): string {
    const label = this.bandLabel(index);
    const security = this.getBandSecurityValue(index);
    return security ? `${label} - ${security}` : label;
  }

  private buildWifiPayload() {
    const bandCount = this.wifiBands.length || this.bandsArray.length;
    const primary = this.wifiConfigForm.get('primary')?.value || { name: null, password: null, security: null };
    const bands = this.useSameForAll
      ? Array.from({ length: bandCount }).map((_, index) => ({
        ssid: primary.name,
        password: primary.password,
        security: this.resolveSecurityForBand(index, primary.security),
      }))
      : this.bandsArray.controls.map((control) => {
        const value = control.value;
        return { ssid: value.name, password: value.password, security: value.security };
      });

    if (this.wifiDataV2.length) {
      const wifiDataV2 = this.wifiDataV2.map((band, index) => {
        const next = { ...band };
        next.bandData = Array.isArray(band.bandData) ? band.bandData.map((item: any) => ({ ...item })) : [];
        next.bandData = next.bandData.map((item: any) => {
          if (item?.name === 'ssid') {
            return { ...item, value: bands[index]?.ssid ?? item?.value };
          }
          if (item?.name === 'password') {
            return { ...item, value: bands[index]?.password ?? item?.value };
          }
          if (item?.name === 'security') {
            return { ...item, value: bands[index]?.security ?? item?.value };
          }
          return item;
        });
        return next;
      });

      return { wifiDataV2 };
    }

    const payload: any = { wifiData: bands };

    if (bands[0]) {
      payload.twoG = { name: bands[0].ssid, password: bands[0].password };
    }
    if (bands[1]) {
      payload.fiveG = { name: bands[1].ssid, password: bands[1].password };
    }
    if (bands[2]) {
      payload.thirdG = { name: bands[2].ssid, password: bands[2].password };
    }

    return payload;
  }

  private getPrimaryForMessage() {
    const payload = this.buildWifiPayload();
    const first = payload?.wifiData?.[0]
      || payload?.wifiDataV2?.[0]?.bandData?.find((item: any) => item?.name === 'ssid')
      || {};
    const password = payload?.wifiData?.[0]?.password
      || payload?.wifiDataV2?.[0]?.bandData?.find((item: any) => item?.name === 'password')?.value
      || '';
    return {
      ssid: first.ssid || first.value || '',
      password,
    };
  }

  private extractBands(res: any): { bands: any[]; securityOptions: string[][] } {
    if (Array.isArray(res?.wifiDataV2)) {
      this.wifiDataV2 = res.wifiDataV2;
      const securityOptions = res.wifiDataV2.map((band: any) => {
        const securityItem = band?.bandData?.find((item: any) => item?.name === 'security');
        const values = Array.isArray(securityItem?.editParams?.values) ? securityItem.editParams.values : [];
        return this.mergeSecurityOptions(values, securityItem?.value || null);
      });

      const bands = res.wifiDataV2.map((band: any) => {
        const ssid = band?.bandData?.find((item: any) => item?.name === 'ssid')?.value;
        const password = band?.bandData?.find((item: any) => item?.name === 'password')?.value;
        const bandLabel = band?.bandData?.find((item: any) => item?.name === 'band')?.value;
        const securityItem = band?.bandData?.find((item: any) => item?.name === 'security');
        const security = securityItem?.value;
        return { ssid, password, band: bandLabel, security };
      });

      return { bands, securityOptions };
    }

    const legacyBands = Array.isArray(res?.wifiData)
      ? res.wifiData
      : (Array.isArray(res?.wifiData?.wifiData) ? res.wifiData.wifiData : []);
    this.wifiDataV2 = [];
    return { bands: legacyBands, securityOptions: [] };
  }

  public securityMenuOptions(index: number): MenuButtonAction[] {
    const options = this.securityOptions[index] || [];
    const selected = this.getBandSecurityValue(index);
    return options.map((name) => ({
      name,
      icon: selected === name ? 'checkmark' : undefined,
    }));
  }

  public onSecuritySelected(index: number, event: MenuEvent) {
    const options = this.securityOptions[index] || [];
    const value = options[event?.index ?? 0];
    if (!value) {
      return;
    }
    if (index === 0) {
      this.wifiConfigForm.get('primary.security')?.setValue(value);
    } else {
      this.bandsArray.at(index)?.get('security')?.setValue(value);
    }
  }

  private getBandSecurityValue(index: number): string | null {
    if (index === 0) {
      return this.wifiConfigForm.get('primary.security')?.value ?? null;
    }
    return this.bandsArray.at(index)?.get('security')?.value ?? null;
  }

  private resolveSecurityForBand(index: number, primarySecurity: string | null): string | null {
    const options = this.securityOptions[index] || [];
    if (primarySecurity && options.includes(primarySecurity)) {
      return primarySecurity;
    }
    const current = this.bandsArray.at(index)?.get('security')?.value ?? null;
    if (current && (options.length === 0 || options.includes(current))) {
      return current;
    }
    return options[0] || primarySecurity || current || null;
  }

  private mergeSecurityOptions(values: string[], fallbackValue: string | null): string[] {
    const uniqueValues = new Set<string>();
    values.forEach((value) => {
      if (value) {
        uniqueValues.add(value);
      }
    });
    if (fallbackValue) {
      uniqueValues.add(fallbackValue);
    }
    return Array.from(uniqueValues);
  }

  public onchange(event: any) {
    const selectedIndex = event?.newIndex ?? event?.value ?? event?.selectedIndex ?? 0;
    console.log('Selected Index:', selectedIndex);
    this.selectedIndex = selectedIndex;
    this.device = this.deviceOptions[selectedIndex];
    if (!this.device) {
      return;
    }
    console.log('device:', this.device);
    this.setLoading(true);
    this.useSameForAll = true;
    this.wifiConfigService.getWifiConfig(this.userId, this.job.accountNumber, this.job.workOrderNumber, this.device.mac, this.device.serialNumber || this.device.deviceSerialNumber).subscribe({
      next: (res) => {
        console.log(res);

        this.configSetId = res.configSetId;
        this.wifiData = res;

        const extracted = this.extractBands(res);
        const bands = extracted.bands;
        console.log('BANDS >', bands)
        this.securityOptions = extracted.securityOptions;
        this.wifiBands = bands.map((band, index) => ({
          label: band.band || this.getBandLabel(band, index),
        }));
        this.setBandsForm(bands);
        this.wifiConfigForm.patchValue({
          primary: {
            name: bands[0]?.ssid || null,
            password: bands[0]?.password || null,
            security: bands[0]?.security || null,
          },
        });

        setTimeout(() => {
          this.wifiConfigForm.markAsPristine();
        }, 20);

        this.setLoading(false);

      }, error: (error) => {
        console.log(error);
        this.wifiConfigForm.reset();
        this.setLoading(false);
      }
    });
  }

  private setLoading(value: boolean): void {
    setTimeout(() => {
      this.isLoading = value;
      this.cdr.detectChanges();
    }, 0);
  }

  onSelectedMainMenu(args: MenuEvent, menuStatus) {
    console.log('selected:', args.index);

    switch (args.index) {
      case 0:
        this.onchange({ newIndex: this.selectedIndex });
        break;
      case 1:
        this.sendWifiConfig();
        break;
      case 2:
        this.updateWifiConfig();
        break;
    }
  }

  public closeModal(): void {
    this.modalParams.closeCallback();
  }
}
