import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { alert } from '@nativescript/core';
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
  public expenseForm = new FormGroup({
    expenseTypeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly userId: number;

  constructor(
    private modalParams: ModalDialogParams,
    private expensesService: ExpensesService
  ) {
    this.userId = Number(this.modalParams.context?.userId || 0);
  }

  public close(): void {
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

  private showError(message: string): Promise<void> {
    return alert({
      title: 'Expenses',
      message,
      okButtonText: 'OK',
    });
  }
}
