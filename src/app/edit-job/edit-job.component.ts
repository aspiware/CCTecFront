import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit, ViewChild } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Dialogs } from '@nativescript/core';
import { getNumber } from '@nativescript/core/application-settings';
import { SegmentedBarItem } from '@nativescript/core';
import { ObservableArray } from '@nativescript/core';
import { ListViewEventData } from 'nativescript-ui-listview';
import { NativeScriptUIListViewModule, RadListViewComponent } from 'nativescript-ui-listview/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { QuantityStepperComponent } from '../shared/components/quantity-stepper/quantity-stepper.component';
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
  public isKeyboardOpen = false;
  public isLoading = false;
  public viewReady = false;
  public isLoadingTypes = false;
  public emptyMessage = '';
  public jobTypes: any[] = [];
  public jobTypeLabels: string[] = ['Loading job types...'];
  public selectedTypeIndex = 0;
  public modemsQty = 0;
  public segmentItems: SegmentedBarItem[] = [];
  public selectedSegmentIndex = 0;
  public jobUserTypesList = new ObservableArray<any>([]);
  public selectedJobType: any[] = [];
  public selectedCustomTypeIds = new Set<number>();
  public customTypeEmptyMessage = '';
  @ViewChild('listView', { static: false, read: RadListViewComponent })
  public listViewRef?: RadListViewComponent;
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
    ],
  };

  constructor(
    private modalParams: ModalDialogParams,
    private todayService: TodayService,
    private cdr: ChangeDetectorRef
  ) {
    this.job = this.modalParams.context;
    this.notes = this.job?.notes || '';
    this.modemsQty = Number(this.job?.modems || 0);
    const initialCustomIds = Array.isArray(this.job?.customJob?.jobTypesIds)
      ? this.job.customJob.jobTypesIds
      : [];
    this.selectedCustomTypeIds = new Set(initialCustomIds.map((id: any) => Number(id)).filter((id: number) => !!id));
    this.segmentItems = ['Residential', 'XH', 'Business', 'Fiber'].map((label) => {
      const item = new SegmentedBarItem();
      item.title = label;
      return item;
    });
  }

  ngOnInit(): void {
    this.userId = getNumber('userId', 15);
    setTimeout(() => {
      this.viewReady = true;
      this.loadJobTypes();
      this.cdr.detectChanges();
    }, 0);
  }

  public onSelectedMainMenu(event: MenuEvent, _menuStatus?: any): void {
    switch (event?.index) {
      case 0:
        this.saveJobChanges();
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
    if (this.isCustomJobTypeSelected) {
      this.loadCustomTypesBySegment();
      return;
    }
    this.jobUserTypesList.splice(0);
    this.selectedJobType = [];
    this.selectedCustomTypeIds.clear();
    this.customTypeEmptyMessage = '';
  }

  public onSegmentChanged(event: any): void {
    const index = Number(event?.value);
    if (Number.isNaN(index) || index < 0 || index > 3) {
      return;
    }
    this.selectedSegmentIndex = index;
    if (this.isCustomJobTypeSelected) {
      this.loadCustomTypesBySegment();
    }
  }

  public onNotesChanged(value: string): void {
    this.notes = value || '';
  }

  public onNotesFocus(): void {
    this.isKeyboardOpen = true;
    this.cdr.detectChanges();
  }

  public onNotesBlur(): void {
    this.isKeyboardOpen = false;
    this.cdr.detectChanges();
  }

  public onModemsChanged(value: number): void {
    this.modemsQty = Number(value || 0);
  }

  public get isCustomJobTypeSelected(): boolean {
    const selected = this.jobTypes[this.selectedTypeIndex];
    return Number(selected?.id) === 17;
  }

  public onListLoaded(): void {
    // kept for parity with old implementation
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
            this.emptyMessage = '';
            if (this.isCustomJobTypeSelected) {
              this.loadCustomTypesBySegment();
            }
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
    const nextJobTypeId = Number(
      selectedType?.id || this.job?.jobTypeId || this.job?.jobType?.id || 0
    );

    const payload = [
      this.job?.id,
      nextJobTypeId || this.job?.jobTypeId,
      this.notes || null,
    ];

    this.setLoading(true);
    this.todayService.update(payload).subscribe({
      next: () => {
        this.setLoading(false);
        this.modalParams.closeCallback({
          ...this.job,
          jobTypeId: nextJobTypeId || this.job?.jobTypeId,
          modems: String(this.modemsQty),
          notes: this.notes || null,
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
        this.customTypeEmptyMessage = list.length ? '' : 'No custom job types for this segment.';
      },
      error: (error) => {
        console.log('[EditJob] getJobPricesByUser error', error);
        this.jobUserTypesList.splice(0);
        this.customTypeEmptyMessage = 'Unable to load custom job types.';
      },
    });
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
}
