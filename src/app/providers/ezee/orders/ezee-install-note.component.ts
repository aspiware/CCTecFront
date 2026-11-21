import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy } from '@angular/core';
import {
  ModalDialogParams,
  NativeScriptCommonModule,
  NativeScriptFormsModule,
} from '@nativescript/angular';
import { action, ApplicationSettings, isAndroid, isIOS, Utils } from '@nativescript/core';
import { EzeeOrderListItem } from './ezee-order.model';

interface EzeeInstallNoteFields {
  address: string;
  walkthroughPerformedWith: string;
  equipmentLocation: string;
  fiberInstallationProcess: string;
  assistedRouterSetup: boolean;
  eeroSpeeds: string;
  terminalSplice: boolean;
  nidSplice: boolean;
  nidLightLevels: string;
  ontLightLevels: string;
  ontSerialNumber: string;
  eeroSerialNumber: string;
  techNotes: string;
  techNameId: string;
  date: string;
}

@Component({
  standalone: true,
  selector: 'app-ezee-install-note',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-install-note.component.html',
  styleUrl: './ezee-install-note.component.scss',
})
export class EzeeInstallNoteComponent implements OnDestroy {
  public readonly order: EzeeOrderListItem;
  public readonly equipmentLocations = [
    'Living Room',
    'Bedroom',
    'Home Office',
    'Basement',
    'Garage',
    'Utility Room',
    'Closet',
    'Attic',
    'Other',
  ];
  public readonly fiberInstallationProcesses = [
    'Wall Fish',
    'Wall Penetration',
    'Duct to Attic',
  ];
  public fields: EzeeInstallNoteFields;
  public preview = '';
  private dismissKeyboardTimer?: ReturnType<typeof setTimeout>;
  private suppressDismissUntil = 0;

  public constructor(
    private modalParams: ModalDialogParams,
    private cdr: ChangeDetectorRef
  ) {
    this.order = this.modalParams.context?.order || ({} as EzeeOrderListItem);
    this.fields = this.initialFields();
    this.updatePreview();
  }

  public ngOnDestroy(): void {
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
    }
  }

  public close(): void {
    this.modalParams.closeCallback();
  }

  public addNote(): void {
    this.dismissKeyboard();
    this.modalParams.closeCallback(this.buildNote());
  }

  public updatePreview(): void {
    this.preview = this.buildNote();
  }

  public async selectEquipmentLocation(): Promise<void> {
    this.dismissKeyboard();
    const selected = await action({
      title: 'Equipment Location',
      message: 'Select the equipment location',
      cancelButtonText: 'Cancel',
      actions: this.equipmentLocations,
    });
    if (selected && this.equipmentLocations.includes(selected)) {
      this.fields.equipmentLocation = selected;
      this.updatePreview();
      this.cdr.detectChanges();
    }
  }

  public async selectFiberInstallationProcess(): Promise<void> {
    this.dismissKeyboard();
    const selected = await action({
      title: 'Fiber Installation Process',
      message: 'Select the installation process',
      cancelButtonText: 'Cancel',
      actions: this.fiberInstallationProcesses,
    });
    if (selected && this.fiberInstallationProcesses.includes(selected)) {
      this.fields.fiberInstallationProcess = selected;
      this.updatePreview();
      this.cdr.detectChanges();
    }
  }

  public onYesNoChanged(
    field: 'assistedRouterSetup' | 'terminalSplice' | 'nidSplice',
    event: any
  ): void {
    this.fields[field] = Boolean(event?.value ?? event?.object?.checked ?? false);
    this.updatePreview();
  }

  public onInputTap(): void {
    this.suppressDismissUntil = Date.now() + 350;
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
      this.dismissKeyboardTimer = undefined;
    }
  }

  public onContainerTap(event: any): void {
    if (Date.now() < this.suppressDismissUntil || this.isTextInputTap(event)) {
      return;
    }
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
    }
    this.dismissKeyboardTimer = setTimeout(() => {
      this.dismissKeyboard();
      this.dismissKeyboardTimer = undefined;
    }, 120);
  }

  public onScrollViewLoaded(event: any): void {
    if (!isIOS) {
      return;
    }
    const scrollView = event?.object?.nativeViewProtected;
    if (scrollView) {
      scrollView.keyboardDismissMode = UIScrollViewKeyboardDismissMode.OnDrag;
      scrollView.alwaysBounceVertical = true;
    }
  }

  public dismissKeyboard(): void {
    Utils.dismissKeyboard();
  }

  private buildNote(): string {
    return [
      'Close out notes :',
      '',
      `Address: ${this.fields.address}`,
      `Pre-Installation Walkthrough, Performed With: ${this.fields.walkthroughPerformedWith}`,
      `• Equipment Location: ${this.fields.equipmentLocation}`,
      `• Fiber Installation Process: ${this.fields.fiberInstallationProcess}`,
      `• Assisted Customer with Router Setup: ${this.yesNo(this.fields.assistedRouterSetup)}`,
      `• Eero Speeds: ${this.fields.eeroSpeeds}`,
      `• Terminal Splice: ${this.yesNo(this.fields.terminalSplice)}`,
      `• NID Splice: ${this.yesNo(this.fields.nidSplice)}`,
      `• NID Light Levels: ${this.fields.nidLightLevels}`,
      `• ONT Light Levels: ${this.fields.ontLightLevels}`,
      `• ONT Serial Number: ${this.fields.ontSerialNumber}`,
      `• Eero Serial Number: ${this.fields.eeroSerialNumber}`,
      `• Tech notes: ${this.fields.techNotes}`,
      `• Tech Name/ID: ${this.fields.techNameId}`,
      `• Date: ${this.fields.date}`,
    ].join('\n');
  }

  private initialFields(): EzeeInstallNoteFields {
    return {
      address: String(this.order?.address || ''),
      walkthroughPerformedWith: String(this.order?.customer?.fullName || ''),
      equipmentLocation: '',
      fiberInstallationProcess: '',
      assistedRouterSetup: false,
      eeroSpeeds: '',
      terminalSplice: false,
      nidSplice: false,
      nidLightLevels: '',
      ontLightLevels: '',
      ontSerialNumber: '',
      eeroSerialNumber: '',
      techNotes: '',
      techNameId: this.getTechNameId(),
      date: String(this.order?.date || this.today()),
    };
  }

  private getTechNameId(): string {
    try {
      const user = JSON.parse(ApplicationSettings.getString('user', '{}'));
      const name = [user?.name, user?.lastname]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' ');
      const techId = String(user?.techCode || user?.techNumber || '').trim();
      return name && techId ? `${name} (${techId})` : name || techId;
    } catch {
      return '';
    }
  }

  private yesNo(value: boolean): string {
    return value ? 'Yes' : 'No';
  }

  private today(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isTextInputTap(event: any): boolean {
    if (isIOS) {
      const className = String(event?.ios?.view?.className || '');
      return className.includes('UITextField') || className.includes('UITextView');
    }
    if (isAndroid) {
      const className = String(event?.android?.view?.getClass?.()?.getName?.() || '');
      return className.includes('EditText');
    }
    return false;
  }
}
