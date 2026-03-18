import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { alert, SegmentedBarItem } from '@nativescript/core';
import { Item } from '../../shared/components/menu-button/item';
import { MenuEvent } from '../../shared/components/menu-button/common';
import { ExpensesService } from '../expenses.service';

@Component({
  standalone: true,
  selector: 'app-add-expense',
  imports: [NativeScriptCommonModule, ReactiveFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './add-expense.component.html',
  styleUrl: './add-expense.component.scss',
})
export class AddExpenseComponent {
  public isSaving = false;
  public viewReady = false;
  public isLoadingCategories = false;
  public isLoadingTypes = false;
  public allExpenseTypes: any[] = [];
  public expenseTypes: any[] = [];
  public expenseTypeLabels: string[] = [];
  public expenseCategories: any[] = [];
  public categorySegments: SegmentedBarItem[] = [];
  public selectedCategoryIndex = 0;
  public selectedTypeIndex = 0;
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      {
        name: 'Save',
        icon: 'checkmark.circle',
        destructive: true,
        confirm: {
          title: 'Save expense?',
          confirmText: 'Save',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      }
    ],
  };
  public expenseForm = new FormGroup({
    expenseTypeId: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly userId: number;

  constructor(
    private modalParams: ModalDialogParams,
    private expensesService: ExpensesService,
    private cdr: ChangeDetectorRef
  ) {
    this.userId = Number(this.modalParams.context?.userId || 0);
  }

  ngOnInit(): void {
    setTimeout(() => {
      this.viewReady = true;
      this.cdr.detectChanges();
      this.loadExpenseCategories();
      this.loadExpenseTypes();
    }, 0);
  }

  get mainMenuOptions() {
    return this.mainMenu.options;
  }

  public closeWithoutSave(): void {
    if (this.isSaving) {
      return;
    }
    this.modalParams.closeCallback();
  }

  public save(): void {
    if (this.isSaving) {
      return;
    }

    if (!this.userId) {
      this.showError('Missing user.');
      return;
    }

    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const expenseTypeId = Number(this.expenseForm.controls.expenseTypeId.value);
    const amount = Number(this.expenseForm.controls.amount.value);

    if (!expenseTypeId || Number.isNaN(expenseTypeId)) {
      this.showError('Expense type is required.');
      return;
    }

    if (!amount || Number.isNaN(amount)) {
      this.showError('Amount must be greater than 0.');
      return;
    }

    this.isSaving = true;
    this.expensesService.create({
      userId: this.userId,
      expenseTypeId,
      amount,
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.modalParams.closeCallback(res || true);
      },
      error: async (error) => {
        this.isSaving = false;
        const message =
          error?.error?.message ||
          error?.message ||
          'Could not create expense.';
        await this.showError(String(message));
      },
    });
  }

  public onExpenseTypeChanged(event: any): void {
    const index = Number(event?.value);
    if (Number.isNaN(index) || index < 0 || index >= this.expenseTypes.length) {
      this.expenseForm.controls.expenseTypeId.setValue(0);
      return;
    }

    this.selectedTypeIndex = index;
    this.expenseForm.controls.expenseTypeId.setValue(Number(this.expenseTypes[index]?.id || 0));
  }

  public onCategoryChanged(event: any): void {
    const index = Number(event?.value);
    if (Number.isNaN(index) || index < 0 || index >= this.expenseCategories.length) {
      return;
    }

    this.selectedCategoryIndex = index;
    this.applyExpenseTypeFilter();
  }

  private showError(message: string): Promise<void> {
    return alert({
      title: 'Expenses',
      message,
      okButtonText: 'OK',
    });
  }

  public onSelectedMainMenu(event: MenuEvent, _menuStatus?: any): void {
    switch (event?.index) {
      case 0:
        this.save();
        break;
    }
  }

  private loadExpenseTypes(): void {
    this.isLoadingTypes = true;
    this.expensesService.findExpenseTypes().subscribe({
      next: (res) => {
        const types = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        this.allExpenseTypes = types;
        this.applyExpenseTypeFilter();
        this.isLoadingTypes = false;
        this.cdr.detectChanges();
      },
      error: async () => {
        this.isLoadingTypes = false;
        this.cdr.detectChanges();
        await this.showError('Could not load expense types.');
      },
    });
  }

  private loadExpenseCategories(): void {
    this.isLoadingCategories = true;
    this.expensesService.findExpenseCategories().subscribe({
      next: (res) => {
        console.log('[EXPENSES-CATEGORIES]', res)
        const categories = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        this.expenseCategories = categories;
        this.categorySegments = categories.map((category: any) => {
          const item = new SegmentedBarItem();
          item.title = String(category?.name || category?.description || `Category ${category?.id || ''}`);
          return item;
        });
        this.selectedCategoryIndex = 0;
        this.applyExpenseTypeFilter();
        this.isLoadingCategories = false;
        this.cdr.detectChanges();
      },
      error: async () => {
        this.isLoadingCategories = false;
        this.cdr.detectChanges();
        await this.showError('Could not load expense categories.');
      },
    });
  }

  private applyExpenseTypeFilter(): void {
    const selectedCategory = this.expenseCategories[this.selectedCategoryIndex];
    const selectedCategoryId = Number(selectedCategory?.id || 0);
    const hasCategoryRelation = this.allExpenseTypes.some((type: any) =>
      type?.expenseCategoryId !== undefined ||
      type?.categoryId !== undefined
    );

    this.expenseTypes = !selectedCategoryId || !hasCategoryRelation
      ? [...this.allExpenseTypes]
      : this.allExpenseTypes.filter((type: any) => {
          const typeCategoryId = Number(type?.expenseCategoryId ?? type?.categoryId ?? 0);
          return typeCategoryId === selectedCategoryId;
        });

    this.expenseTypeLabels = this.expenseTypes.map((type: any) =>
      String(type?.name || type?.description || `Type ${type?.id || ''}`)
    );

    if (this.expenseTypes.length) {
      this.selectedTypeIndex = 0;
      this.expenseForm.controls.expenseTypeId.setValue(Number(this.expenseTypes[0]?.id || 0));
    } else {
      this.selectedTypeIndex = 0;
      this.expenseForm.controls.expenseTypeId.setValue(0);
    }

    if (this.viewReady) {
      this.cdr.detectChanges();
    }
  }
}
