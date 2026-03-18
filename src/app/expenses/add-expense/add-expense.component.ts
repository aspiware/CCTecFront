import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { alert, File, isAndroid, isIOS, knownFolders, path, SegmentedBarItem, Utils } from '@nativescript/core';
import { Item } from '../../shared/components/menu-button/item';
import { MenuEvent } from '../../shared/components/menu-button/common';
import { ExpenseUploadFile, ExpensesService } from '../expenses.service';

@Component({
  standalone: true,
  selector: 'app-add-expense',
  imports: [NativeScriptCommonModule, ReactiveFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './add-expense.component.html',
  styleUrl: './add-expense.component.scss',
})
export class AddExpenseComponent {
  private static readonly MAX_ATTACHMENTS = 5;
  public isSaving = false;
  public viewReady = false;
  public noteText = '';
  public isLoadingCategories = false;
  public isLoadingTypes = false;
  public amount = 0;
  public amountText = '0.00';
  public allExpenseTypes: any[] = [];
  public expenseTypes: any[] = [];
  public expenseTypeLabels: string[] = [];
  public expenseCategories: any[] = [];
  public categorySegments: SegmentedBarItem[] = [];
  public selectedCategoryIndex = 0;
  public selectedTypeIndex = 0;
  public selectedFiles: ExpenseUploadFile[] = [];
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
  private suppressDismissUntil = 0;
  private dismissKeyboardTimer?: ReturnType<typeof setTimeout>;
  private documentPickerDelegate?: any;

  constructor(
    private modalParams: ModalDialogParams,
    private expensesService: ExpensesService,
    private cdr: ChangeDetectorRef
  ) {
    this.userId = Number(this.modalParams.context?.userId || 0);
    this.expenseForm.controls.amount.setValue(this.amountText);
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

  public onContainerTap(event: any): void {
    if (Date.now() < this.suppressDismissUntil) {
      return;
    }
    if (this.isTextInputTap(event)) {
      return;
    }
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
    }
    this.dismissKeyboardTimer = setTimeout(() => {
      Utils.dismissKeyboard();
      this.dismissKeyboardTimer = undefined;
    }, 120);
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
    const amount = Number(this.amount);

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
      next: async (res) => {
        const createdExpense = res || true;
        const createdExpenseId = this.extractExpenseId(res);

        if (!this.selectedFiles.length || !createdExpenseId) {
          this.isSaving = false;
          this.modalParams.closeCallback(createdExpense);
          return;
        }

        this.expensesService.uploadFiles(createdExpenseId, this.selectedFiles).subscribe({
          next: () => {
            this.isSaving = false;
            this.modalParams.closeCallback(createdExpense);
          },
          error: async (error) => {
            this.isSaving = false;
            const message =
              error?.error?.message ||
              error?.message ||
              'Expense was created, but files could not be uploaded.';
            await this.showError(String(message));
            this.modalParams.closeCallback(createdExpense);
          },
        });
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

  public async pickFiles(): Promise<void> {
    this.onInputTap();

    if (!isIOS) {
      await this.showError('File attachments are only available on iOS for now.');
      return;
    }

    try {
      const files = await this.openDocumentPicker();
      if (!files.length) {
        return;
      }

      const existingPaths = new Set(this.selectedFiles.map((file) => file.path));
      const dedupedFiles = files.filter((file) => !existingPaths.has(file.path));
      if (!dedupedFiles.length) {
        return;
      }

      const availableSlots = AddExpenseComponent.MAX_ATTACHMENTS - this.selectedFiles.length;
      if (availableSlots <= 0) {
        await this.showError(`You can attach up to ${AddExpenseComponent.MAX_ATTACHMENTS} files.`);
        return;
      }

      const filesToAdd = dedupedFiles.slice(0, availableSlots);
      this.selectedFiles = [...this.selectedFiles, ...filesToAdd];
      this.cdr.detectChanges();

      if (dedupedFiles.length > availableSlots) {
        await this.showError(`Only ${AddExpenseComponent.MAX_ATTACHMENTS} files can be attached.`);
      }
    } catch (error: any) {
      const message = error?.message || 'Could not select files.';
      await this.showError(String(message));
    }
  }

  public removeFile(index: number): void {
    if (index < 0 || index >= this.selectedFiles.length) {
      return;
    }

    this.selectedFiles = this.selectedFiles.filter((_, currentIndex) => currentIndex !== index);
    this.cdr.detectChanges();
  }

  public getFileSizeLabel(size?: number): string {
    const numeric = Number(size || 0);
    if (!numeric) {
      return '';
    }

    if (numeric < 1024) {
      return `${numeric} B`;
    }

    if (numeric < 1024 * 1024) {
      return `${(numeric / 1024).toFixed(1)} KB`;
    }

    return `${(numeric / (1024 * 1024)).toFixed(1)} MB`;
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

  public onInputTap(): void {
    this.suppressDismissUntil = Date.now() + 350;
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
      this.dismissKeyboardTimer = undefined;
    }
  }

  public onNoteChanged(value: string): void {
    this.noteText = String(value || '');
  }

  public onAmountChange(event: any): void {
    const rawValue = String(event?.value ?? '');
    const sanitized = this.sanitizePriceInput(rawValue);
    if (event?.object && event.object.text !== sanitized) {
      event.object.text = sanitized;
    }

    this.amountText = sanitized;
    const parsed = Number(sanitized);
    this.amount = Number.isFinite(parsed) ? parsed : 0;
    this.expenseForm.controls.amount.setValue(sanitized);
  }

  public onAmountFocus(): void {
    this.onInputTap();
  }

  public onAmountBlur(): void {
    this.amountText = this.formatPriceInput(this.amount);
    this.expenseForm.controls.amount.setValue(this.amountText);
  }

  private showError(message: string): Promise<void> {
    return alert({
      title: 'Expenses',
      message,
      okButtonText: 'OK',
    });
  }

  private formatPriceInput(value: any): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '0.00';
    }
    return numeric.toFixed(2);
  }

  private sanitizePriceInput(value: string): string {
    const clean = value.replace(/[^0-9.]/g, '');
    const firstDot = clean.indexOf('.');
    if (firstDot < 0) {
      return clean;
    }
    const beforeDot = clean.slice(0, firstDot + 1);
    const afterDot = clean.slice(firstDot + 1).replace(/\./g, '');
    return `${beforeDot}${afterDot}`;
  }

  private isTextInputTap(event: any): boolean {
    if (isIOS) {
      const iosView = event?.ios?.view;
      const className = String(iosView?.className || '');
      return className.includes('UITextField') || className.includes('UITextView');
    }

    if (isAndroid) {
      const androidView = event?.android?.view;
      const className = String(androidView?.getClass?.()?.getName?.() || '');
      return className.includes('EditText');
    }

    return false;
  }

  private extractExpenseId(response: any): number {
    const candidates = [
      response?.id,
      response?.expenseId,
      response?.data?.id,
      response?.data?.expenseId,
    ];

    for (const candidate of candidates) {
      const numeric = Number(candidate);
      if (numeric && !Number.isNaN(numeric)) {
        return numeric;
      }
    }

    return 0;
  }

  private openDocumentPicker(): Promise<ExpenseUploadFile[]> {
    return new Promise((resolve, reject) => {
      try {
        const picker = UIDocumentPickerViewController.alloc().initWithDocumentTypesInMode(
          ['public.item'],
          UIDocumentPickerMode.Import
        );
        picker.allowsMultipleSelection = true;

        const visibleViewController = this.getVisibleViewController();
        if (!visibleViewController) {
          reject(new Error('Could not present file picker.'));
          return;
        }

        const delegate = this.createDocumentPickerDelegate(resolve);
        this.documentPickerDelegate = delegate;
        picker.delegate = delegate;
        visibleViewController.presentViewControllerAnimatedCompletion(picker, true, null);
      } catch (error) {
        reject(error);
      }
    });
  }

  private getVisibleViewController(): UIViewController | null {
    const sharedApplication = UIApplication.sharedApplication;
    const keyWindow =
      sharedApplication.keyWindow ||
      (sharedApplication.windows?.count ? sharedApplication.windows.objectAtIndex(0) : null);
    const rootViewController = keyWindow?.rootViewController;

    if (!rootViewController) {
      return null;
    }

    return Utils.ios.getVisibleViewController(rootViewController);
  }

  private createDocumentPickerDelegate(
    resolver: (files: ExpenseUploadFile[]) => void
  ): UIDocumentPickerDelegate {
    const owner = new WeakRef(this);
    const DelegateClass = (NSObject as any).extend(
      {
        documentPickerDidPickDocumentsAtURLs(
          _controller: UIDocumentPickerViewController,
          urls: NSArray<NSURL> | NSURL[]
        ) {
          console.log('[Expenses][Picker] didPickDocumentsAtURLs');
          const component = owner.deref();
          resolver(component?.handleDocumentPickerUrls(urls) || []);
        },

        documentPickerDidPickDocumentAtURL(
          _controller: UIDocumentPickerViewController,
          url: NSURL
        ) {
          console.log('[Expenses][Picker] didPickDocumentAtURL');
          const component = owner.deref();
          resolver(component?.handleDocumentPickerUrls([url]) || []);
        },

        documentPickerWasCancelled(_controller: UIDocumentPickerViewController) {
          console.log('[Expenses][Picker] cancelled');
          resolver([]);
        },
      },
      {
        protocols: [UIDocumentPickerDelegate],
        name: 'ExpenseDocumentPickerDelegateImpl',
      }
    );

    return DelegateClass.new() as UIDocumentPickerDelegate;
  }

  public handleDocumentPickerUrls(urls: NSArray<NSURL> | NSURL[]): ExpenseUploadFile[] {
    console.log('[Expenses][Picker] handle urls', Array.isArray(urls) ? urls.length : urls?.count);
    const resolvedUrls = Array.isArray(urls)
      ? urls
      : Array.from({ length: urls.count }, (_, index) => urls.objectAtIndex(index));

    const files: ExpenseUploadFile[] = [];
    for (const url of resolvedUrls) {
      console.log('[Expenses][Picker] url', String(url?.absoluteString || ''), String(url?.path || ''));
      const file = this.copyPickedFile(url);
      if (file) {
        files.push(file);
      }
    }

    console.log('[Expenses][Picker] files resolved', files.length);

    return files;
  }

  private copyPickedFile(sourceUrl: NSURL): ExpenseUploadFile | null {
    const fileName = String(sourceUrl?.lastPathComponent || `attachment-${Date.now()}`);
    const sourcePath = String(sourceUrl?.path || '');
    if (sourcePath && File.exists(sourcePath)) {
      const pickedFile = File.fromPath(sourcePath);
      return {
        name: fileName,
        path: sourcePath,
        size: Number(pickedFile.size || 0),
        mimeType: this.getMimeType(fileName),
      };
    }

    const tempPath = path.join(
      knownFolders.temp().path,
      `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`
    );
    const destinationUrl = NSURL.fileURLWithPath(tempPath);
    const fileManager = NSFileManager.defaultManager;

    const didAccessScopedResource = sourceUrl?.startAccessingSecurityScopedResource?.() || false;
    let copyError = new interop.Reference<NSError>();
    if (fileManager.fileExistsAtPath(tempPath)) {
      fileManager.removeItemAtPathError(tempPath, copyError);
    }

    const copied = fileManager.copyItemAtURLToURLError(sourceUrl, destinationUrl, copyError);
    if (didAccessScopedResource) {
      sourceUrl.stopAccessingSecurityScopedResource?.();
    }
    if (!copied) {
      return null;
    }

    const copiedFile = File.fromPath(tempPath);
    return {
      name: fileName,
      path: tempPath,
      size: Number(copiedFile.size || 0),
      mimeType: this.getMimeType(fileName),
    };
  }

  private getMimeType(fileName: string): string {
    const extension = String(fileName.split('.').pop() || '').trim().toLowerCase();
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
      txt: 'text/plain',
      csv: 'text/csv',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return map[extension] || 'application/octet-stream';
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
