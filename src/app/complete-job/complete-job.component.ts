import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { ModalDialogParams, ModalDialogService, NativeScriptCommonModule } from '@nativescript/angular';
import { Dialogs, ScrollView, Utils } from '@nativescript/core';
import { getNumber } from '@nativescript/core/application-settings';
import { SegmentedBarItem } from '@nativescript/core';
import { ObservableArray } from '@nativescript/core';
import { ListViewEventData } from 'nativescript-ui-listview';
import { NativeScriptUIListViewModule, RadListViewComponent } from 'nativescript-ui-listview/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { SettingsService } from '../settings/settings.service';
import { TodayService } from '../today/today.service';
import { lastValueFrom } from 'rxjs';
import { AddNoteComponent } from '../add-note/add-note.component';

@Component({
  standalone: true,
  selector: 'app-complete-job',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './complete-job.component.html',
  styleUrl: './complete-job.component.scss',
})
export class CompleteJobComponent implements OnInit {
  public job: any;
  public isReviewStep = false;
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
  public allResolutionCodes: any[] = [];
  public resolutionSearch = '';
  public selectedJobType: any[] = [];
  public reviewResolutionCodes = new ObservableArray<any>([]);
  public selectedReviewCodeId: number | null = null;
  public selectedCustomTypeIds = new Set<number>();
  public selectedCustomTypeMap = new Map<number, any>();
  public customTypeEmptyMessage = '';
  public updateDeviceItems: Array<{ label: string; selected: boolean; raw: any }> = [];
  public selectedUpgradeDeviceKeys = new Set<string>();
  public changedDeviceIds: number[] = [];
  public settings: any;
  public customTotalPrice = 0;
  @ViewChild('listView', { static: false, read: RadListViewComponent })
  public listViewRef?: RadListViewComponent;
  @ViewChild('reviewListView', { static: false, read: RadListViewComponent })
  public reviewListViewRef?: RadListViewComponent;
  @ViewChild('upgradeDevicesListView', { static: false, read: RadListViewComponent })
  public upgradeDevicesListViewRef?: RadListViewComponent;
  @ViewChild('bodyScroll', { static: false })
  public bodyScrollRef?: ElementRef<ScrollView>;
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      {
        name: 'Complete',
        icon: 'checkmark.circle',
        destructive: true,
        confirm: {
          title: 'Complete job?',
          confirmText: 'Complete',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      },
      {
        name: 'Add note',
        icon: 'note.text.badge.plus',
      },
    ],
  };

  get mainMenuOptions() {
    return this.mainMenu.options;
  }

  constructor(
    private modalParams: ModalDialogParams,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef,
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
      this.loadResolutionCodes();
      this.cdr.detectChanges();
    }, 0);
  }

  public onSelectedMainMenu(event: MenuEvent, _menuStatus?: any): void {
    switch (event?.index) {
      case 0:
        this.saveJobChanges();
        break;
      case 1:
        this.openAddNoteModal();
        break;
      default:
        break;
    }
  }

  public openAddNoteModal(): void {
    const options = this.getModalOptions({ note: this.notes || '' });

    this.modalService.showModal(AddNoteComponent, options).then((result) => {
      if (typeof result === 'string') {
        this.notes = result.trim();
        this.cdr.detectChanges();
      }
    });
  }

  private getModalOptions(context: any): any {
    return {
      context,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
      },
    };
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
      this.loadCustomTypesBySegment();
      return;
    }
    if (this.isUpdateJobTypeSelected) {
      this.tryRestoreUpgradeDevicesSelection();
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
    this.loadResolutionCodes();
  }

  public onResolutionSearchChange(value: string): void {
    this.resolutionSearch = String(value || '');
    this.applyResolutionCodesFilter();
  }

  public clearResolutionSearch(): void {
    if (!this.resolutionSearch) {
      return;
    }
    this.resolutionSearch = '';
    this.applyResolutionCodesFilter();
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

  public onUpgradeDevicesListLoaded(): void {
    this.tryRestoreUpgradeDevicesSelection();
  }

  public onUpgradeDeviceSelected(args: ListViewEventData): void {
    this.setUpgradeDeviceSelection(args?.index, true);
  }

  public onUpgradeDeviceDeselected(args: ListViewEventData): void {
    this.setUpgradeDeviceSelection(args?.index, false);
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

  public onReviewItemSelected(args: ListViewEventData): void {
    const item = this.reviewResolutionCodes.getItem(args?.index);
    const id = Number(item?.jobTypeId || item?.id);
    this.selectedReviewCodeId = Number.isFinite(id) && id > 0 ? id : null;
    this.syncSingleReviewSelection(args?.index);
  }

  public goBackStep(): void {
    if (this.isReviewStep) {
      this.isReviewStep = false;
      this.cdr.detectChanges();
      return;
    }
    this.closeModal();
  }

  public goNextStep(): void {
    if (this.isReviewStep) {
      if (!this.selectedReviewCodeId) {
        Dialogs.alert({
          title: 'Resolution Code',
          message: 'Select one resolution code to continue.',
          okButtonText: 'OK',
        });
        return;
      }
      this.saveJobChanges();
      return;
    }

    if (!this.selectedJobType.length) {
      Dialogs.alert({
        title: 'Resolution Codes',
        message: 'Select at least one resolution code before continuing.',
        okButtonText: 'OK',
      });
      return;
    }

    this.reviewResolutionCodes.splice(0);
    this.reviewResolutionCodes.push(...this.selectedJobType);
    const firstSelected = this.selectedJobType[0];
    const firstSelectedId = Number(firstSelected?.jobTypeId || firstSelected?.id);
    this.selectedReviewCodeId = Number.isFinite(firstSelectedId) && firstSelectedId > 0 ? firstSelectedId : null;
    this.isReviewStep = true;
    this.cdr.detectChanges();
    setTimeout(() => this.syncSingleReviewSelection(), 0);
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
              this.tryRestoreUpgradeDevicesSelection();
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

  private async loadResolutionCodes(): Promise<void> {
    const workOrderNumber = this.job?.workOrderNumber;
    if (!this.userId || !workOrderNumber) {
      this.jobUserTypesList.splice(0);
      this.customTypeEmptyMessage = 'Unable to load resolution codes.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingTypes = true;
    this.setLoading(true);
    this.emptyMessage = '';
    this.customTypeEmptyMessage = '';
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.todayService.resolCodes(this.userId, workOrderNumber)
      );
      const list = this.mapResolutionCodes(this.extractResolutionCodes(response));
      this.allResolutionCodes = list;
      if (list.length) {
        this.applyResolutionCodesFilter();
      } else {
        this.jobUserTypesList.splice(0);
        this.customTypeEmptyMessage = 'No resolution codes available.';
      }
    } catch (error) {
      console.log('[CompleteJob] resolCodes error', error);
      this.allResolutionCodes = [];
      this.jobUserTypesList.splice(0);
      this.customTypeEmptyMessage = 'Unable to load resolution codes.';
    } finally {
      this.isLoadingTypes = false;
      this.setLoading(false);
      this.cdr.detectChanges();
    }
  }

  private extractResolutionCodes(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    const candidates = [
      response?.data,
      response?.resolCodes,
      response?.codeList,
      response?.codes,
      response?.items,
      response?.result,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    return [];
  }

  private mapResolutionCodes(list: any[]): any[] {
    return (Array.isArray(list) ? list : []).map((item: any, index: number) => {
      const rawId = item?.id ?? item?.jobTypeId ?? item?.resolCodeId ?? item?.codeId;
      const numericId = Number(rawId);
      const id = Number.isFinite(numericId) && numericId > 0 ? numericId : index + 1;
      const name =
        item?.name ||
        item?.description ||
        item?.label ||
        item?.resolCode ||
        item?.code ||
        `Code ${index + 1}`;

      return {
        ...item,
        id,
        name,
      };
    });
  }

  private applyResolutionCodesFilter(): void {
    const query = this.resolutionSearch.trim().toLowerCase();
    const filtered = !query
      ? this.allResolutionCodes
      : this.allResolutionCodes.filter((item) => {
          const code = String(item?.code || '').toLowerCase();
          const description = String(item?.description || '').toLowerCase();
          return code.includes(query) || description.includes(query);
        });

    this.jobUserTypesList.splice(0);
    if (filtered.length) {
      this.jobUserTypesList.push(...filtered);
      this.customTypeEmptyMessage = '';
    } else {
      this.customTypeEmptyMessage = 'No resolution codes match your search.';
    }
    this.tryRestoreSegmentSelection();
    this.cdr.detectChanges();
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

    if (this.isReviewStep && this.selectedReviewCodeId) {
      this.selectedCustomTypeIds = new Set([this.selectedReviewCodeId]);
      this.selectedJobType = this.selectedJobType.filter((entry) => {
        const id = Number(entry?.jobTypeId || entry?.id);
        return id === this.selectedReviewCodeId;
      });
      this.selectedCustomTypeMap.forEach((_value, key) => {
        if (key !== this.selectedReviewCodeId) {
          this.selectedCustomTypeMap.delete(key);
        }
      });
    }

    const selectedType = this.jobTypes[this.selectedTypeIndex];
    const nextJobTypeId = this.isCustomChecked
      ? 17
      : Number(selectedType?.id || this.job?.jobTypeId || this.job?.jobType?.id || 0);

    const updatedJob = {
      ...this.job,
      jobTypeId: nextJobTypeId || this.job?.jobTypeId,
      changedDeviceIds: [...this.changedDeviceIds],
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
    this.todayService.getJobPricesByUser(this.userId, categoryId, true).subscribe({
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

    const categoryId = this.getSelectedSegmentCategory();
    this.customTypeEmptyMessage = '';
    this.todayService.getJobPricesByUser(this.userId, categoryId, true).subscribe({
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
      const item = this.updateDeviceItems[i];
      const key = this.getUpgradeDeviceKey(item?.raw);
      if (item?.selected || (!!key && this.selectedUpgradeDeviceKeys.has(key))) {
        listView.selectItemAt(i);
      }
    }
  }

  private tryRestoreUpgradeDevicesSelection(attempt = 0): void {
    this.restoreUpgradeDevicesSelection();
    if (this.upgradeDevicesListViewRef?.listView || attempt >= 20) {
      return;
    }
    setTimeout(() => this.tryRestoreUpgradeDevicesSelection(attempt + 1), 100);
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

  private syncSingleReviewSelection(selectedIndex?: number): void {
    const listView = this.reviewListViewRef?.listView;
    if (!listView || !this.reviewResolutionCodes?.length) {
      return;
    }

    let targetIndex = typeof selectedIndex === 'number' ? selectedIndex : -1;
    if (targetIndex < 0 && this.selectedReviewCodeId) {
      targetIndex = this.reviewResolutionCodes.findIndex((item: any) => {
        const id = Number(item?.jobTypeId || item?.id);
        return id === this.selectedReviewCodeId;
      });
    }

    for (let i = 0; i < this.reviewResolutionCodes.length; i++) {
      if (i === targetIndex) {
        listView.selectItemAt(i);
      } else {
        listView.deselectItemAt(i);
      }
    }
  }
}
