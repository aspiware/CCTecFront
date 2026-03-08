import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnInit, ViewChild } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Dialogs, ScrollView, Utils } from '@nativescript/core';
import { getNumber } from '@nativescript/core/application-settings';
import { SegmentedBarItem } from '@nativescript/core';
import { ObservableArray } from '@nativescript/core';
import { ListViewEventData } from 'nativescript-ui-listview';
import { NativeScriptUIListViewModule, RadListViewComponent } from 'nativescript-ui-listview/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { QuantityStepperComponent } from '../shared/components/quantity-stepper/quantity-stepper.component';
import { SettingsService } from '../settings/settings.service';
import { TodayService } from '../today/today.service';

@Component({
  standalone: true,
  selector: 'app-edit-job',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule, QuantityStepperComponent],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './edit-job.component.html',
  styleUrl: './edit-job.component.scss',
})
export class EditJobComponent implements OnInit {
  public job: any;
  private userId = 0;
  public notes = '';
  public isNotesFocused = false;
  public isLoading = false;
  public viewReady = false;
  public isLoadingTypes = false;
  public emptyMessage = '';
  public jobTypes: any[] = [];
  public jobTypeLabels: string[] = ['Loading job types...'];
  public selectedTypeIndex = 0;
  public modemsQty = 0;
  public tvBoxesQty = 0;
  public camerasQty = 0;
  public sensorsQty = 0;
  public includePanel = false;
  public segmentItems: SegmentedBarItem[] = [];
  public selectedSegmentIndex = 0;
  public isCustomChecked = false;
  public jobUserTypesList = new ObservableArray<any>([]);
  public selectedJobType: any[] = [];
  public selectedCustomTypeIds = new Set<number>();
  public selectedCustomTypeMap = new Map<number, any>();
  public customTypeEmptyMessage = '';
  public showUpdateDevicesSelector = false;
  public updateDeviceItems: Array<{ label: string; selected: boolean; raw: any }> = [];
  public settings: any;
  public customTotalPrice = 0;
  @ViewChild('listView', { static: false, read: RadListViewComponent })
  public listViewRef?: RadListViewComponent;
  @ViewChild('bodyScroll', { static: false })
  public bodyScrollRef?: ElementRef<ScrollView>;
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      {
        name: 'Save',
        icon: 'checkmark.circle',
        destructive: true,
        confirm: {
          title: 'Save job changes?',
          confirmText: 'Save',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      },
      {
        name: 'Custom Job',
        icon: 'wrench.and.screwdriver',
        toggle: true,
      },
    ],
  };

  get mainMenuOptions() {
    return this.mainMenu.options.map((option) => {
      if (option.name === 'Custom Job') {
        return { ...option, checked: this.isCustomChecked };
      }
      return option;
    });
  }

  constructor(
    private modalParams: ModalDialogParams,
    private todayService: TodayService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef
  ) {
    this.job = this.modalParams.context;
    const normalizedCustomJob = this.normalizeCustomJob(this.job?.customJob);
    this.notes = this.job?.notes || '';
    this.isCustomChecked = Number(this.job?.jobTypeId || this.job?.jobType?.id) === 17;
    this.modemsQty = Number(normalizedCustomJob?.modems ?? this.job?.modems ?? 0);
    this.tvBoxesQty = Number(normalizedCustomJob?.tvBoxes ?? this.job?.tvBoxes ?? 0);
    this.camerasQty = Number(normalizedCustomJob?.cameras ?? this.job?.cameras ?? 0);
    this.sensorsQty = Number(normalizedCustomJob?.sensors ?? this.job?.sensors ?? 0);
    this.includePanel = this.toBoolean(normalizedCustomJob?.hasPanel ?? false);
    const initialCustomIds = this.parseCustomTypeIds(normalizedCustomJob?.jobTypesIds);
    this.selectedCustomTypeIds = new Set(initialCustomIds.map((id: any) => Number(id)).filter((id: number) => !!id));
    const initialCustomTypeItems = Array.isArray(normalizedCustomJob?.jobTypes)
      ? normalizedCustomJob.jobTypes
      : [];
    initialCustomTypeItems.forEach((item: any) => {
      const id = Number(item?.jobTypeId || item?.id);
      if (id) {
        this.selectedCustomTypeMap.set(id, item);
      }
    });
    this.segmentItems = ['Residential', 'XH', 'Business', 'Fiber'].map((label) => {
      const item = new SegmentedBarItem();
      item.title = label;
      return item;
    });
  }

  ngOnInit(): void {
    this.userId = getNumber('userId', 0);
    this.initUpdateDeviceItems();
    setTimeout(() => {
      this.viewReady = true;
      this.loadSettings();
      this.loadJobTypes();
      this.cdr.detectChanges();
    }, 0);
  }

  public onSelectedMainMenu(event: MenuEvent, _menuStatus?: any): void {
    switch (event?.index) {
      case 0:
        this.saveJobChanges();
        break;
      case 1:
        this.toggleCustomJob();
        break;
      default:
        break;
    }
  }

  public closeModal(): void {
    this.modalParams.closeCallback();
  }

  public onTypeChanged(event: any): void {
    const index = Number(event?.value);
    if (Number.isNaN(index) || index < 0 || index >= this.jobTypes.length) {
      return;
    }
    this.selectedTypeIndex = index;
    const selected = this.jobTypes[this.selectedTypeIndex];
    this.isCustomChecked = Number(selected?.id) === 17;
    this.showUpdateDevicesSelector = false;
    if (this.isCustomJobTypeSelected) {
      this.loadCustomTypesBySegment();
      return;
    }
    this.jobUserTypesList.splice(0);
    this.selectedJobType = [];
    this.selectedCustomTypeIds.clear();
    this.selectedCustomTypeMap.clear();
    this.customTypeEmptyMessage = '';
    this.recalculateCustomTotal();
  }

  public onSegmentChanged(event: any): void {
    const index = Number(event?.value);
    if (Number.isNaN(index) || index < 0 || index > 3) {
      return;
    }
    this.selectedSegmentIndex = index;
    if (!this.isCustomJobTypeSelected) {
      this.loadPickerJobsBySegment();
    }
    this.loadCustomTypesBySegment();
  }

  public onNotesChanged(value: string): void {
    this.notes = value || '';
  }

  public onNotesFocus(): void {
    this.isNotesFocused = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      const scroll = this.bodyScrollRef?.nativeElement;
      scroll?.scrollToVerticalOffset?.(10000, true);
    }, 80);
  }

  public onNotesBlur(): void {
    this.isNotesFocused = false;
    this.cdr.detectChanges();
  }

  public dismissNotesKeyboard(): void {
    if (!this.isNotesFocused) {
      return;
    }
    Utils.dismissKeyboard();
    this.isNotesFocused = false;
    this.cdr.detectChanges();
  }

  public onModemsChanged(value: number): void {
    this.modemsQty = Number(value || 0);
    this.recalculateCustomTotal();
  }

  public onTvBoxesChanged(value: number): void {
    this.tvBoxesQty = Number(value || 0);
    this.recalculateCustomTotal();
  }

  public onCamerasChanged(value: number): void {
    this.camerasQty = Number(value || 0);
    this.recalculateCustomTotal();
  }

  public onSensorsChanged(value: number): void {
    this.sensorsQty = Number(value || 0);
    this.recalculateCustomTotal();
  }

  public onIncludePanelChanged(event: any): void {
    this.includePanel = this.toBoolean(event?.value ?? event?.object?.checked ?? false);
    this.recalculateCustomTotal();
  }

  public get isCustomJobTypeSelected(): boolean {
    if (this.isCustomChecked) {
      return true;
    }
    const selected = this.jobTypes[this.selectedTypeIndex];
    return Number(selected?.id) === 17;
  }

  public get isUpdateJobTypeSelected(): boolean {
    if (this.isCustomJobTypeSelected) {
      return false;
    }
    const selected = this.jobTypes[this.selectedTypeIndex];
    const selectedName = String(selected?.name || selected?.description || '').trim().toLowerCase();
    const currentName = String(this.job?.jobType?.name || this.job?.jobType?.description || '').trim().toLowerCase();
    return selectedName.includes('upgrade') || currentName.includes('upgrade');
  }

  public toggleUpdateDevicesSelector(): void {
    this.showUpdateDevicesSelector = !this.showUpdateDevicesSelector;
  }

  public onUpdateDeviceCheckedChange(index: number, event: any): void {
    if (index < 0 || index >= this.updateDeviceItems.length) {
      return;
    }
    const checked = this.toBoolean(event?.value ?? event?.object?.checked ?? false);
    this.updateDeviceItems[index].selected = checked;
    const serial = this.updateDeviceItems[index]?.raw?.serialNumber || this.updateDeviceItems[index]?.raw?.deviceSerialNumber;
    const devices = Array.isArray(this.job?.devices) ? this.job.devices : [];
    const deviceIndex = devices.findIndex((device: any) => {
      const deviceSerial = device?.serialNumber || device?.deviceSerialNumber;
      return deviceSerial === serial;
    });
    if (deviceIndex >= 0) {
      devices[deviceIndex] = {
        ...devices[deviceIndex],
        wasChangedUpgrade: checked ? 1 : 0,
      };
    }
  }

  public onListLoaded(): void {
    this.tryRestoreSegmentSelection();
  }

  public onItemSelected(args: ListViewEventData): void {
    const item = this.jobUserTypesList.getItem(args?.index);
    const id = Number(item?.jobTypeId || item?.id);
    if (!id) {
      return;
    }
    if (!this.selectedCustomTypeIds.has(id)) {
      this.selectedCustomTypeIds.add(id);
      this.selectedJobType.push(item);
      this.selectedCustomTypeMap.set(id, item);
      this.recalculateCustomTotal();
    }
  }

  public onItemDeselected(args: ListViewEventData): void {
    const item = this.jobUserTypesList.getItem(args?.index);
    const id = Number(item?.jobTypeId || item?.id);
    if (!id) {
      return;
    }
    this.selectedCustomTypeIds.delete(id);
    this.selectedJobType = this.selectedJobType.filter((entry) => Number(entry?.jobTypeId || entry?.id) !== id);
    this.selectedCustomTypeMap.delete(id);
    this.recalculateCustomTotal();
  }

  private loadJobTypes(): void {
    this.isLoadingTypes = true;
    this.setLoading(true);
    this.emptyMessage = '';
    this.jobTypeLabels = ['Loading job types...'];
    this.selectedTypeIndex = 0;
    this.todayService.findJobTypes(false).subscribe({
      next: (res: any) => {
        console.log('[EditJob] findJobTypes response:', res);
        const list = this.extractJobTypes(res);
        console.log('[EditJob] parsed job types:', list?.length || 0);
        this.applyViewState(() => {
          this.jobTypes = list;
          if (list.length) {
            this.jobTypeLabels = list.map((item) => item?.name || item?.description || `Type #${item?.id}`);
            this.selectedTypeIndex = this.findInitialIndex(list);
            this.isCustomChecked = Number(list[this.selectedTypeIndex]?.id) === 17;
            this.emptyMessage = '';
            if (!this.isCustomChecked) {
              this.loadPickerJobsBySegment();
            }
            this.loadCustomTypesBySegment();
            this.recalculateCustomTotal();
          } else {
            this.jobTypeLabels = ['No job types available'];
            this.selectedTypeIndex = 0;
            this.emptyMessage = 'No job types available.';
          }
          this.isLoadingTypes = false;
          this.setLoading(false);
        });
      },
      error: (error) => {
        console.log('[EditJob] findJobTypes error', error);
        this.applyViewState(() => {
          this.jobTypes = [];
          this.jobTypeLabels = ['Unable to load job types'];
          this.selectedTypeIndex = 0;
          this.emptyMessage = 'Unable to load job types.';
          this.isLoadingTypes = false;
          this.setLoading(false);
        });
      },
    });
  }

  private setLoading(value: boolean): void {
    setTimeout(() => {
      this.isLoading = value;
      this.cdr.detectChanges();
    }, 0);
  }

  private saveJobChanges(): void {
    if (this.isLoading || !this.job) {
      return;
    }

    const selectedType = this.jobTypes[this.selectedTypeIndex];
    const nextJobTypeId = this.isCustomChecked
      ? 17
      : Number(selectedType?.id || this.job?.jobTypeId || this.job?.jobType?.id || 0);

    const updatedJob = {
      ...this.job,
      jobTypeId: nextJobTypeId || this.job?.jobTypeId,
      modems: String(this.modemsQty),
      tvBoxes: String(this.tvBoxesQty),
      cameras: String(this.camerasQty),
      sensors: String(this.sensorsQty),
      customJob: this.isCustomJobTypeSelected
        ? {
            ...(this.job?.customJob || {}),
            modems: this.modemsQty,
            tvBoxes: this.tvBoxesQty,
            cameras: this.camerasQty,
            sensors: this.sensorsQty,
            hasPanel: this.includePanel,
            jobTypesIds: Array.from(this.selectedCustomTypeIds),
            totalPrice: this.customTotalPrice,
          }
        : this.job?.customJob,
      notes: this.notes || null,
    };

    const save$ = this.isCustomJobTypeSelected
      ? this.todayService.updateCustomJob([
          updatedJob.id,
          17,
          updatedJob.notes,
          JSON.stringify(updatedJob.customJob?.jobTypesIds || []),
          Number(updatedJob.customJob?.sensors || 0),
          Number(updatedJob.customJob?.cameras || 0),
          Number(updatedJob.customJob?.tvBoxes || 0),
          Number(updatedJob.customJob?.modems || 0),
          Boolean(updatedJob.customJob?.hasPanel),
        ])
      : this.todayService.update([
          updatedJob.id,
          updatedJob.jobTypeId,
          updatedJob.notes,
        ]);

    console.log(
      '[EditJob] save endpoint:',
      this.isCustomJobTypeSelected ? 'updateCustomJob' : 'update'
    );
    console.log(
      '[EditJob] save payload:',
      this.isCustomJobTypeSelected
        ? [
            updatedJob.id,
            17,
            updatedJob.notes,
            JSON.stringify(updatedJob.customJob?.jobTypesIds || []),
            Number(updatedJob.customJob?.sensors || 0),
            Number(updatedJob.customJob?.cameras || 0),
            Number(updatedJob.customJob?.tvBoxes || 0),
            Number(updatedJob.customJob?.modems || 0),
            Boolean(updatedJob.customJob?.hasPanel),
          ]
        : [updatedJob.id, updatedJob.jobTypeId, updatedJob.notes]
    );

    this.setLoading(true);
    save$.subscribe({
      next: () => {
        this.setLoading(false);
        this.modalParams.closeCallback(updatedJob);
      },
      error: (error) => {
        console.log('[EditJob] update error', error);
        this.setLoading(false);
        Dialogs.alert({
          title: 'Update',
          message: 'Unable to save job changes.',
          okButtonText: 'OK',
        });
      },
    });
  }

  private applyViewState(update: () => void): void {
    setTimeout(() => {
      update();
      this.cdr.detectChanges();
    });
  }

  private findInitialIndex(list: any[]): number {
    const currentTypeId = Number(this.job?.jobTypeId || this.job?.jobType?.id);
    if (!currentTypeId) {
      return list.length ? 0 : -1;
    }
    const index = list.findIndex((item) => Number(item?.id) === currentTypeId);
    return index >= 0 ? index : (list.length ? 0 : -1);
  }

  private extractJobTypes(res: any): any[] {
    if (Array.isArray(res)) {
      return res;
    }
    if (Array.isArray(res?.data)) {
      return res.data;
    }
    if (Array.isArray(res?.rows)) {
      return res.rows;
    }
    if (Array.isArray(res?.jobTypes)) {
      return res.jobTypes;
    }
    if (res && typeof res === 'object') {
      const values = Object.values(res);
      const firstArray = values.find((value) => Array.isArray(value));
      if (Array.isArray(firstArray)) {
        return firstArray as any[];
      }
      const objectValues = values.filter((value) => value && typeof value === 'object' && !Array.isArray(value));
      if (objectValues.length) {
        return objectValues as any[];
      }
    }
    return [];
  }

  private loadPickerJobsBySegment(): void {
    if (!this.userId) {
      return;
    }
    const currentTypeId = Number(
      this.jobTypes[this.selectedTypeIndex]?.id ||
      this.job?.jobTypeId ||
      this.job?.jobType?.id ||
      0
    );
    const category = this.getSelectedSegmentCategory();
    this.todayService.getJobPricesByUser(this.userId, category, true).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        if (!list.length) {
          return;
        }
        const normalized = list.map((item: any) => ({
          id: Number(item?.jobTypeId || item?.id),
          name: item?.name || item?.description || '-',
        }));
        this.jobTypes = normalized;
        this.jobTypeLabels = normalized.map((item: any) => item.name);
        const nextIndex = normalized.findIndex((item: any) => Number(item?.id) === currentTypeId);
        this.selectedTypeIndex = nextIndex >= 0 ? nextIndex : 0;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[EditJob] loadPickerJobsBySegment error', error);
      },
    });
  }

  private loadCustomTypesBySegment(): void {
    if (!this.userId) {
      this.jobUserTypesList.splice(0);
      this.customTypeEmptyMessage = 'Unable to load custom job types.';
      return;
    }

    const category = this.getSelectedSegmentCategory();
    this.customTypeEmptyMessage = '';
    this.todayService.getJobPricesByUser(this.userId, category, true).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        this.jobUserTypesList.splice(0);
        this.jobUserTypesList.push(...list);
        this.hydrateSelectedCustomItemsFromCurrentList();
        this.customTypeEmptyMessage = list.length ? '' : 'No custom job types for this segment.';
        this.tryRestoreSegmentSelection();
        this.recalculateCustomTotal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[EditJob] getJobPricesByUser error', error);
        this.jobUserTypesList.splice(0);
        this.customTypeEmptyMessage = 'Unable to load custom job types.';
        this.cdr.detectChanges();
      },
    });
  }

  private toggleCustomJob(): void {
    this.isCustomChecked = !this.isCustomChecked;
    if (this.isCustomChecked) {
      this.resetEditFormState();
      this.showUpdateDevicesSelector = false;
      this.loadCustomTypesBySegment();
      this.recalculateCustomTotal();
      this.cdr.detectChanges();
      return;
    }
    if (this.selectedTypeIndex < 0 && this.jobTypes.length) {
      this.selectedTypeIndex = 0;
    }
    this.customTypeEmptyMessage = '';
    this.jobUserTypesList.splice(0);
    this.selectedCustomTypeIds.clear();
    this.selectedCustomTypeMap.clear();
    this.selectedJobType = [];
    this.recalculateCustomTotal();
    this.cdr.detectChanges();
  }

  private resetEditFormState(): void {
    this.notes = '';
    this.modemsQty = 0;
    this.tvBoxesQty = 0;
    this.camerasQty = 0;
    this.sensorsQty = 0;
    this.includePanel = false;
    this.selectedSegmentIndex = 0;
    this.jobUserTypesList.splice(0);
    this.selectedCustomTypeIds.clear();
    this.selectedCustomTypeMap.clear();
    this.selectedJobType = [];
    this.customTypeEmptyMessage = '';
  }

  public get customTotalPriceText(): string {
    return `$${this.customTotalPrice.toFixed(2)}`;
  }

  private loadSettings(): void {
    this.settingsService.findByUser(this.userId).subscribe({
      next: (res) => {
        this.settings = res || {};
        this.recalculateCustomTotal();
      },
      error: () => {
        this.settings = {};
        this.recalculateCustomTotal();
      },
    });
  }

  private restoreSegmentSelection(): void {
    const listView = this.listViewRef?.listView;
    if (!listView || !this.jobUserTypesList?.length) {
      return;
    }
    for (let i = 0; i < this.jobUserTypesList.length; i++) {
      const item = this.jobUserTypesList.getItem(i);
      const id = Number(item?.jobTypeId || item?.id);
      if (this.selectedCustomTypeIds.has(id)) {
        listView.selectItemAt(i);
      }
    }
  }

  private tryRestoreSegmentSelection(attempt = 0): void {
    this.restoreSegmentSelection();
    if (this.listViewRef?.listView || attempt >= 20) {
      return;
    }
    setTimeout(() => this.tryRestoreSegmentSelection(attempt + 1), 100);
  }

  private hydrateSelectedCustomItemsFromCurrentList(): void {
    if (!this.jobUserTypesList?.length || !this.selectedCustomTypeIds.size) {
      return;
    }
    for (let i = 0; i < this.jobUserTypesList.length; i++) {
      const item = this.jobUserTypesList.getItem(i);
      const id = Number(item?.jobTypeId || item?.id);
      if (id && this.selectedCustomTypeIds.has(id)) {
        this.selectedCustomTypeMap.set(id, item);
      }
    }
  }

  private recalculateCustomTotal(): void {
    if (!this.isCustomJobTypeSelected) {
      this.customTotalPrice = 0;
      return;
    }

    let selectedJobsTotal = 0;
    this.selectedCustomTypeMap.forEach((item) => {
      selectedJobsTotal += Number(item?.price || 0);
    });

    const modemPrice = Number(this.settings?.modemPrice || 0);
    const boxPrice = Number(this.settings?.boxPrice || 0);
    const cameraPrice = Number(this.settings?.cameraPrice || 0);
    const sensorPrice = Number(this.settings?.sensorPrice || 0);
    const panelPrice = Number(this.settings?.xhPanelPrice || 0);

    const devicesTotal =
      (this.modemsQty * modemPrice) +
      (this.tvBoxesQty * boxPrice) +
      (this.camerasQty * cameraPrice) +
      (this.sensorsQty * sensorPrice) +
      (this.includePanel ? panelPrice : 0);

    this.customTotalPrice = Number((selectedJobsTotal + devicesTotal).toFixed(2));
  }

  private getSelectedSegmentCategory(): string {
    switch (this.selectedSegmentIndex) {
      case 0:
        return 'Residential';
      case 1:
        return 'XH';
      case 2:
        return 'Business';
      case 3:
        return 'Fiber';
      default:
        return 'Residential';
    }
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.trim().toLowerCase() === 'true';
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return false;
  }

  private normalizeCustomJob(raw: any): any {
    if (!raw) {
      return {};
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' ? raw : {};
  }

  private parseCustomTypeIds(raw: any): number[] {
    if (Array.isArray(raw)) {
      return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    }
    if (typeof raw === 'number') {
      return raw > 0 ? [raw] : [];
    }
    if (typeof raw !== 'string') {
      return [];
    }

    const value = raw.trim();
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
      }
      if (typeof parsed === 'number') {
        return parsed > 0 ? [parsed] : [];
      }
    } catch {
      // continue with csv/simple fallback
    }

    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((part) => Number(String(part).replace(/"/g, '').trim()))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private initUpdateDeviceItems(): void {
    const devices = Array.isArray(this.job?.devices) ? this.job.devices : [];
    this.updateDeviceItems = devices.map((device: any) => {
      const label =
        device?.serialNumber ||
        device?.deviceSerialNumber ||
        device?.deviceModel ||
        device?.name ||
        'Device';
      return {
        label,
        selected: Number(device?.wasChangedUpgrade || 0) === 1,
        raw: device,
      };
    });
  }
}
