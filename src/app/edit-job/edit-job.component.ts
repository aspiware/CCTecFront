import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { TodayService } from '../today/today.service';

@Component({
  standalone: true,
  selector: 'app-edit-job',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './edit-job.component.html',
  styleUrl: './edit-job.component.scss',
})
export class EditJobComponent implements OnInit {
  public job: any;
  public notes = '';
  public isKeyboardOpen = false;
  public isLoadingTypes = false;
  public emptyMessage = '';
  public jobTypes: any[] = [];
  public jobTypeLabels: string[] = ['Loading job types...'];
  public selectedTypeIndex = 0;
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [{ name: 'Options', icon: 'ellipsis.circle' }],
  };

  constructor(
    private modalParams: ModalDialogParams,
    private todayService: TodayService,
    private cdr: ChangeDetectorRef
  ) {
    this.job = this.modalParams.context;
    this.notes = this.job?.notes || '';
  }

  ngOnInit(): void {
    this.loadJobTypes();
  }

  public onSelectedMainMenu(_event: MenuEvent): void {
    // Placeholder: menu actions will be added later.
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

  private loadJobTypes(): void {
    this.isLoadingTypes = true;
    this.emptyMessage = '';
    this.jobTypeLabels = ['Loading job types...'];
    this.selectedTypeIndex = 0;
    this.todayService.findJobTypes(true).subscribe({
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
          } else {
            this.jobTypeLabels = ['No job types available'];
            this.selectedTypeIndex = 0;
            this.emptyMessage = 'No job types available.';
          }
          this.isLoadingTypes = false;
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
}
