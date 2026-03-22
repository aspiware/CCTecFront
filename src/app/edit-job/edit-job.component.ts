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
  public customEquipmentItems: any[] = [];
  public customEquipmentRows: any[][] = [];
  private initialCustomEquipmentSelections: any[] = [];
  private customEquipmentStateByCategory = new Map<number, any[]>();
  public updateDeviceItems: Array<{ label: string; selected: boolean; raw: any }> = [];
  public selectedUpgradeDeviceKeys = new Set<string>();
  public changedDeviceIds: number[] = [];
  public settings: any;
  public customTotalPrice = 0;
  @ViewChild('listView', { static: false, read: RadListViewComponent })
  public listViewRef?: RadListViewComponent;
  @ViewChild('upgradeDevicesListView', { static: false, read: RadListViewComponent })
  public upgradeDevicesListViewRef?: RadListViewComponent;
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
    this.initialCustomEquipmentSelections = this.parseCustomEquipmentSelections(normalizedCustomJob?.equipmentSelections);
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

    console.log('[normalizedCustomJob]', this.job?.customJob);
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
    if (this.isCustomJobTypeSelected) {
      this.loadCustomEquipmentsBySegment();
      this.loadCustomTypesBySegment();
      return;
    }
    if (this.isUpdateJobTypeSelected) {
      this.scheduleUpgradeDevicesSelectionRestore();
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
    this.loadCustomEquipmentsBySegment();
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

  public onCustomEquipmentQtyChanged(item: any, value: number): void {
    if (!item) {
      return;
    }
    item.quantity = Number(value || 0);
    this.persistCurrentCustomEquipmentState();
    this.syncLegacyCustomEquipmentState();
    this.recalculateCustomTotal();
  }

  public onCustomEquipmentToggleChanged(item: any, event: any): void {
    if (!item) {
      return;
    }
    item.enabled = this.toBoolean(event?.value ?? event?.object?.checked ?? false);
    this.persistCurrentCustomEquipmentState();
    this.syncLegacyCustomEquipmentState();
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

  public onUpgradeDevicesListLoaded(): void {
    this.scheduleUpgradeDevicesSelectionRestore();
  }

  public onUpgradeDeviceSelected(args: ListViewEventData): void {
    this.setUpgradeDeviceSelection(args?.index, true);
  }

  public onUpgradeDeviceDeselected(args: ListViewEventData): void {
    this.setUpgradeDeviceSelection(args?.index, false);
  }

  public onUpgradeDeviceRowTap(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.updateDeviceItems.length) {
      return;
    }

    const listView = this.upgradeDevicesListViewRef?.listView;
    const nextSelected = !this.updateDeviceItems[index]?.selected;

    this.setUpgradeDeviceSelection(index, nextSelected);

    if (listView) {
      if (nextSelected) {
        listView.selectItemAt(index);
      } else {
        listView.deselectItemAt(index);
      }
    }

    this.cdr.detectChanges();
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
            if (this.isUpdateJobTypeSelected) {
              this.scheduleUpgradeDevicesSelectionRestore();
            }
            if (this.isCustomJobTypeSelected) {
              this.loadCustomEquipmentsBySegment();
              this.preloadAllCustomEquipments();
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
      changedDeviceIds: [...this.changedDeviceIds],
      modems: Number(this.modemsQty || 0),
      tvBoxes: Number(this.tvBoxesQty || 0),
      cameras: Number(this.camerasQty || 0),
      sensors: Number(this.sensorsQty || 0),
      customJob: this.isCustomJobTypeSelected
        ? {
            ...(this.job?.customJob || {}),
            modems: Number(this.modemsQty || 0),
            tvBoxes: Number(this.tvBoxesQty || 0),
            cameras: Number(this.camerasQty || 0),
            sensors: Number(this.sensorsQty || 0),
            hasPanel: this.includePanel ? 1 : 0,
            jobTypesIds: Array.from(this.selectedCustomTypeIds),
            totalPrice: this.customTotalPrice,
            equipmentSelections: this.buildCustomEquipmentSelections(),
          }
        : this.job?.customJob,
      notes: this.notes || null,
    };

    // console.log(updatedJob.customJob.equipmentSelections);
    // return

    const save$ = this.isCustomJobTypeSelected
      ? this.todayService.updateCustomJob({
          id: Number(updatedJob.id || 0),
          jobTypeId: 17,
          notes: updatedJob.notes,
          jobTypesIds: JSON.stringify(updatedJob.customJob?.jobTypesIds || []),
          sensors: Number(updatedJob.customJob?.sensors || 0),
          cameras: Number(updatedJob.customJob?.cameras || 0),
          tvBoxes: Number(updatedJob.customJob?.tvBoxes || 0),
          modems: Number(updatedJob.customJob?.modems || 0),
          hasPanel: Number(updatedJob.customJob?.hasPanel || 0),
          equipmentSelections: updatedJob.customJob?.equipmentSelections || [],
        })
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
        ? {
            id: Number(updatedJob.id || 0),
            jobTypeId: 17,
            notes: updatedJob.notes,
            jobTypesIds: JSON.stringify(updatedJob.customJob?.jobTypesIds || []),
            sensors: Number(updatedJob.customJob?.sensors || 0),
            cameras: Number(updatedJob.customJob?.cameras || 0),
            tvBoxes: Number(updatedJob.customJob?.tvBoxes || 0),
            modems: Number(updatedJob.customJob?.modems || 0),
            hasPanel: Number(updatedJob.customJob?.hasPanel || 0),
            equipmentSelections: updatedJob.customJob?.equipmentSelections || [],
          }
        : [updatedJob.id, updatedJob.jobTypeId, updatedJob.notes]
    );

    const shouldSyncChangedDevices = this.isUpdateJobTypeSelected && Number(updatedJob?.id || 0) > 0;
    this.setLoading(true);
    save$.subscribe({
      next: () => {
        if (!shouldSyncChangedDevices) {
          this.setLoading(false);
          this.modalParams.closeCallback(updatedJob);
          return;
        }

        const jobId = Number(updatedJob.id);
        const devicesId = Array.isArray(updatedJob.changedDeviceIds) ? updatedJob.changedDeviceIds : [];
        console.log('[EditJob] changedDevices payload:', { jobId, devicesId });
        this.todayService.changedDevices(jobId, devicesId).subscribe({
          next: () => {
            this.setLoading(false);
            this.modalParams.closeCallback(updatedJob);
          },
          error: (error) => {
            console.log('[EditJob] changedDevices error', error);
            this.setLoading(false);
            Dialogs.alert({
              title: 'Update',
              message: 'Job was updated, but changed devices could not be saved.',
              okButtonText: 'OK',
            });
          },
        });
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
    const categoryId = this.getSelectedSegmentCategory();
    this.todayService.getJobPricesByUser(this.userId, categoryId).subscribe({
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
        if (this.isUpdateJobTypeSelected) {
          this.scheduleUpgradeDevicesSelectionRestore();
        }
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

    const categoryId = this.getSelectedSegmentCategory();
    this.customTypeEmptyMessage = '';
    this.todayService.getJobPricesByUser(this.userId, categoryId).subscribe({
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

  private loadCustomEquipmentsBySegment(): void {
    if (!this.userId || !this.isCustomJobTypeSelected) {
      this.customEquipmentItems = [];
      this.customEquipmentRows = [];
      this.syncLegacyCustomEquipmentState();
      this.recalculateCustomTotal();
      this.cdr.detectChanges();
      return;
    }

    const categoryId = this.getSelectedSegmentCategory();
    this.loadCustomEquipmentsForCategory(categoryId, true);
  }

  private preloadAllCustomEquipments(): void {
    if (!this.userId || !this.isCustomJobTypeSelected) {
      return;
    }

    [1, 2, 3, 4].forEach((categoryId) => {
      if (categoryId === this.getSelectedSegmentCategory()) {
        return;
      }
      this.loadCustomEquipmentsForCategory(categoryId, false);
    });
  }

  private loadCustomEquipmentsForCategory(categoryId: number, updateCurrentView: boolean): void {
    this.todayService.getEquipmentsByCategory(this.userId, categoryId).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        const normalizedItems = list
          .map((item: any) => this.normalizeCustomEquipment(item, categoryId))
          .sort((a: any, b: any) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0));
        const restoredItems = this.restoreCustomEquipmentState(categoryId, normalizedItems);
        this.customEquipmentStateByCategory.set(
          categoryId,
          restoredItems.map((item: any) => ({ ...item }))
        );
        if (updateCurrentView) {
          this.customEquipmentItems = restoredItems;
          this.customEquipmentRows = this.chunkCustomEquipmentRows(
            this.customEquipmentItems.filter((item: any) => item?.inputType === 'quantity')
          );
        }
        this.syncLegacyCustomEquipmentState();
        this.recalculateCustomTotal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[EditJob] getEquipmentsByCategory error', error);
        if (updateCurrentView) {
          this.customEquipmentItems = [];
          this.customEquipmentRows = [];
        }
        this.syncLegacyCustomEquipmentState();
        this.recalculateCustomTotal();
        this.cdr.detectChanges();
      },
    });
  }

  private toggleCustomJob(): void {
    this.isCustomChecked = !this.isCustomChecked;
    if (this.isCustomChecked) {
      this.resetEditFormState();
      this.loadCustomEquipmentsBySegment();
      this.preloadAllCustomEquipments();
      this.loadCustomTypesBySegment();
      this.recalculateCustomTotal();
      this.cdr.detectChanges();
      return;
    }
    if (this.jobTypes.length) {
      const current = this.jobTypes[this.selectedTypeIndex];
      const currentId = Number(current?.id || 0);
      if (this.selectedTypeIndex < 0 || currentId === 17) {
        const firstNonCustomIndex = this.jobTypes.findIndex((item) => Number(item?.id) !== 17);
        this.selectedTypeIndex = firstNonCustomIndex >= 0 ? firstNonCustomIndex : 0;
      }
      this.loadPickerJobsBySegment();
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
    this.customEquipmentItems = [];
    this.customEquipmentRows = [];
    this.customEquipmentStateByCategory.clear();
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

    let devicesTotal = 0;
    this.customEquipmentStateByCategory.forEach((items: any[]) => {
      devicesTotal += items.reduce((sum: number, item: any) => {
        const price = Number(item?.price || 0);
        if (item?.inputType === 'toggle') {
          return sum + (item?.enabled ? price : 0);
        }
        return sum + (Number(item?.quantity || 0) * price);
      }, 0);
    });

    this.customTotalPrice = Number((selectedJobsTotal + devicesTotal).toFixed(2));
  }

  private getSelectedSegmentCategory(): number {
    switch (this.selectedSegmentIndex) {
      case 0:
        return 1;
      case 1:
        return 2;
      case 2:
        return 3;
      case 3:
        return 4;
      default:
        return 1;
    }
  }

  private normalizeCustomEquipment(item: any, categoryId: number): any {
    const key = this.getCustomEquipmentKey(item);
    const inputType = key === 'panel' ? 'toggle' : 'quantity';
    const equipmentId = Number(item?.equipmentId || item?.id || 0);
    return {
      id: equipmentId,
      name: String(item?.equipmentName || item?.name || '-'),
      description: String(item?.equipmentDescription || item?.description || ''),
      sortOrder: Number(item?.sortOrder || 0),
      price: Number(item?.price || 0),
      key,
      inputType,
      quantity: inputType === 'quantity' ? this.getInitialCustomEquipmentQuantity(categoryId, equipmentId, key) : 0,
      enabled: inputType === 'toggle' ? this.getInitialCustomEquipmentToggle(categoryId, equipmentId, key) : false,
    };
  }

  private getCustomEquipmentKey(item: any): string {
    const text = String(
      item?.equipmentName ||
      item?.name ||
      item?.equipmentDescription ||
      item?.description ||
      ''
    ).toLowerCase();
    if (text.includes('modem') || text.includes('mta') || text.includes('hsi') || text.includes('cm')) {
      return 'modems';
    }
    if (text.includes('tv') || text.includes('box') || text.includes('stb')) {
      return 'tvBoxes';
    }
    if (text.includes('camera')) {
      return 'cameras';
    }
    if (text.includes('sensor')) {
      return 'sensors';
    }
    if (text.includes('panel')) {
      return 'panel';
    }
    return `equipment-${item?.equipmentId || item?.id || text}`;
  }

  private getInitialCustomEquipmentQuantity(categoryId: number, equipmentId: number, key: string): number {
    const savedSelection = this.initialCustomEquipmentSelections.find((item: any) =>
      Number(item?.jobCategoryId || 0) === Number(categoryId || 0) &&
      Number(item?.equipmentId || 0) === Number(equipmentId || 0)
    );
    if (savedSelection) {
      return Number(savedSelection?.quantity || 0);
    }

    if (categoryId !== 2) {
      return 0;
    }

    switch (key) {
      case 'modems':
        return Number(this.modemsQty || 0);
      case 'tvBoxes':
        return Number(this.tvBoxesQty || 0);
      case 'cameras':
        return Number(this.camerasQty || 0);
      case 'sensors':
        return Number(this.sensorsQty || 0);
      default:
        return 0;
    }
  }

  private getInitialCustomEquipmentToggle(categoryId: number, equipmentId: number, key: string): boolean {
    const savedSelection = this.initialCustomEquipmentSelections.find((item: any) =>
      Number(item?.jobCategoryId || 0) === Number(categoryId || 0) &&
      Number(item?.equipmentId || 0) === Number(equipmentId || 0)
    );
    if (savedSelection) {
      return Number(savedSelection?.quantity || 0) > 0;
    }

    return categoryId === 2 && key === 'panel' ? this.includePanel : false;
  }

  private syncLegacyCustomEquipmentState(): void {
    const allItems = Array.from(this.customEquipmentStateByCategory.values()).flat();
    const getQty = (key: string) =>
      allItems.reduce((sum: number, item: any) => {
        if (item?.key !== key) {
          return sum;
        }
        return sum + Number(item?.quantity || 0);
      }, 0);
    const getToggle = (key: string) =>
      allItems.some((item: any) => item?.key === key && this.toBoolean(item?.enabled));

    this.modemsQty = getQty('modems');
    this.tvBoxesQty = getQty('tvBoxes');
    this.camerasQty = getQty('cameras');
    this.sensorsQty = getQty('sensors');
    this.includePanel = getToggle('panel');
  }

  private persistCurrentCustomEquipmentState(): void {
    if (!this.isCustomJobTypeSelected) {
      return;
    }
    this.customEquipmentStateByCategory.set(
      this.getSelectedSegmentCategory(),
      this.customEquipmentItems.map((item: any) => ({ ...item }))
    );
  }

  private restoreCustomEquipmentState(categoryId: number, items: any[]): any[] {
    const savedItems = this.customEquipmentStateByCategory.get(categoryId) || [];
    if (!savedItems.length) {
      return items;
    }

    return items.map((item: any) => {
      const saved = savedItems.find((entry: any) => Number(entry?.id || 0) === Number(item?.id || 0));
      if (!saved) {
        return item;
      }
      return {
        ...item,
        quantity: Number(saved?.quantity || 0),
        enabled: this.toBoolean(saved?.enabled),
      };
    });
  }

  private chunkCustomEquipmentRows(items: any[]): any[][] {
    const rows: any[][] = [];
    for (let index = 0; index < items.length; index += 2) {
      rows.push(items.slice(index, index + 2));
    }
    return rows;
  }

  private buildCustomEquipmentSelections(): Array<{ jobCategoryId: number; equipmentId: number; quantity: number }> {
    const selections: Array<{ jobCategoryId: number; equipmentId: number; quantity: number }> = [];

    this.customEquipmentStateByCategory.forEach((items: any[], jobCategoryId: number) => {
      items.forEach((item: any) => {
        const equipmentId = Number(item?.id || 0);
        if (!equipmentId) {
          return;
        }

        if (item?.inputType === 'toggle') {
          selections.push({
            jobCategoryId,
            equipmentId,
            quantity: this.toBoolean(item?.enabled) ? 1 : 0,
          });
          return;
        }

        const quantity = Number(item?.quantity || 0);
        if (quantity > 0) {
          selections.push({ jobCategoryId, equipmentId, quantity });
        }
      });
    });

    return selections;
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes';
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

  private parseCustomEquipmentSelections(raw: any): any[] {
    if (Array.isArray(raw)) {
      return raw;
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
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
    this.selectedUpgradeDeviceKeys.clear();
    this.updateDeviceItems = devices.map((device: any) => {
      const label =
        device?.serialNumber ||
        device?.deviceSerialNumber ||
        device?.deviceModel ||
        device?.name ||
        'Device';
      const selected = this.toBoolean(device?.wasChangedUpgrade);
      if (selected) {
        const key = this.getUpgradeDeviceKey(device);
        if (key) {
          this.selectedUpgradeDeviceKeys.add(key);
        }
      }
      return {
        label,
        selected,
        raw: device,
      };
    });
    this.syncChangedDeviceIds();
  }

  private setUpgradeDeviceSelection(index: number, selected: boolean): void {
    if (index < 0 || index >= this.updateDeviceItems.length) {
      return;
    }
    this.updateDeviceItems[index].selected = selected;
    const raw = this.updateDeviceItems[index]?.raw;
    const key = this.getUpgradeDeviceKey(raw);
    if (key) {
      if (selected) {
        this.selectedUpgradeDeviceKeys.add(key);
      } else {
        this.selectedUpgradeDeviceKeys.delete(key);
      }
    }
    this.syncChangedDeviceIds();
  }

  private syncChangedDeviceIds(): void {
    this.changedDeviceIds = this.updateDeviceItems
      .filter((item) => item.selected)
      .map((item) => Number(item?.raw?.id || item?.raw?.deviceId || item?.raw?.jobDeviceId || 0))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private restoreUpgradeDevicesSelection(): void {
    const listView = this.upgradeDevicesListViewRef?.listView;
    if (!listView || !this.updateDeviceItems?.length) {
      return;
    }
    for (let i = 0; i < this.updateDeviceItems.length; i++) {
      listView.deselectItemAt(i);
    }
    for (let i = 0; i < this.updateDeviceItems.length; i++) {
      const item = this.updateDeviceItems[i];
      const key = this.getUpgradeDeviceKey(item?.raw);
      if (item?.selected || (!!key && this.selectedUpgradeDeviceKeys.has(key))) {
        listView.selectItemAt(i);
      }
    }
    this.cdr.detectChanges();
  }

  private tryRestoreUpgradeDevicesSelection(attempt = 0): void {
    this.restoreUpgradeDevicesSelection();
    if (this.upgradeDevicesListViewRef?.listView || attempt >= 20) {
      return;
    }
    setTimeout(() => this.tryRestoreUpgradeDevicesSelection(attempt + 1), 100);
  }

  private scheduleUpgradeDevicesSelectionRestore(): void {
    this.tryRestoreUpgradeDevicesSelection();
    [80, 180, 320, 500].forEach((delay) => {
      setTimeout(() => this.restoreUpgradeDevicesSelection(), delay);
    });
  }

  private getUpgradeDeviceKey(device: any): string {
    const id = Number(device?.id || device?.deviceId || device?.jobDeviceId || 0);
    if (Number.isFinite(id) && id > 0) {
      return `id:${id}`;
    }
    const serial = String(device?.serialNumber || device?.deviceSerialNumber || '').trim();
    if (serial) {
      return `sn:${serial}`;
    }
    return '';
  }
}
