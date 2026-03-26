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
  public isEditMode = false;
  public modalTitle = 'Add Expense';
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
  public expenseForm = new FormGroup({
    expenseTypeId: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly userId: number;
  private readonly expenseId: number;
  private readonly existingExpense: any;
  private suppressDismissUntil = 0;
  private dismissKeyboardTimer?: ReturnType<typeof setTimeout>;
  private documentPickerDelegate?: any;
  private imagePickerDelegate?: any;

  constructor(
    private modalParams: ModalDialogParams,
    private expensesService: ExpensesService,
    private cdr: ChangeDetectorRef
  ) {
    this.userId = Number(this.modalParams.context?.userId || 0);
    this.existingExpense = this.modalParams.context?.expense || null;
    this.expenseId = Number(this.existingExpense?.id || this.modalParams.context?.expenseId || 0);
    this.isEditMode = !!this.expenseId;
    this.modalTitle = this.isEditMode ? 'Edit Expense' : 'Add Expense';
    this.expenseForm.controls.amount.setValue(this.amountText);
    this.hydrateExistingExpense();
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
    return [
      {
        name: this.isEditMode ? 'Update' : 'Save',
        icon: 'checkmark.circle',
        destructive: true,
        confirm: {
          title: this.isEditMode ? 'Update expense?' : 'Save expense?',
          confirmText: this.isEditMode ? 'Update' : 'Save',
          cancelText: 'Cancel',
          presentation: 'anchor' as const,
        },
      },
    ];
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

  public onScrollViewLoaded(event: any): void {
    if (!isIOS) {
      return;
    }

    const iosScrollView = event?.object?.nativeViewProtected;
    if (iosScrollView) {
      iosScrollView.keyboardDismissMode = UIScrollViewKeyboardDismissMode.OnDrag;
      iosScrollView.alwaysBounceVertical = true;
    }
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
    const notes = String(this.noteText || '').trim();
    const request$ = this.isEditMode
      ? this.expensesService.update(this.expenseId, {
          expenseTypeId,
          amount,
          notes: notes || undefined,
        })
      : this.expensesService.create({
          userId: this.userId,
          expenseTypeId,
          amount,
          notes: notes || undefined,
        });

    request$.subscribe({
      next: async (res) => {
        const savedExpense = res || true;
        const targetExpenseId = this.isEditMode
          ? this.expenseId
          : this.extractExpenseId(res);

        if (!this.selectedFiles.length || !targetExpenseId) {
          this.isSaving = false;
          this.modalParams.closeCallback(savedExpense);
          return;
        }

        this.expensesService.uploadFiles(targetExpenseId, this.selectedFiles).subscribe({
          next: () => {
            this.isSaving = false;
            this.modalParams.closeCallback(savedExpense);
          },
          error: async (error) => {
            this.isSaving = false;
            const message =
              error?.error?.message ||
              error?.message ||
              this.isEditMode
                ? 'Expense was updated, but files could not be uploaded.'
                : 'Expense was created, but files could not be uploaded.';
            await this.showError(String(message));
            this.modalParams.closeCallback(savedExpense);
          },
        });
      },
      error: async (error) => {
        this.isSaving = false;
        const message =
          error?.error?.message ||
          error?.message ||
          this.isEditMode ? 'Could not update expense.' : 'Could not create expense.';
        await this.showError(String(message));
      },
    });
  }

  public async pickFiles(event?: any): Promise<void> {
    this.onInputTap();

    if (!isIOS) {
      await this.showError('File attachments are only available on iOS for now.');
      return;
    }

    this.openAttachmentSourceMenu(event?.object?.ios as UIView | undefined);
  }

  private async pickDocuments(): Promise<void> {
    try {
      const files = await this.openDocumentPicker();
      await this.appendSelectedFiles(files);
    } catch (error: any) {
      const message = error?.message || 'Could not select files.';
      await this.showError(String(message));
    }
  }

  private async takePhoto(): Promise<void> {
    try {
      const files = await this.openCameraPicker();
      await this.appendSelectedFiles(files);
    } catch (error: any) {
      const message = error?.message || 'Could not capture photo.';
      await this.showError(String(message));
    }
  }

  private async pickPhotos(): Promise<void> {
    try {
      const files = await this.openPhotoLibraryPicker();
      await this.appendSelectedFiles(files);
    } catch (error: any) {
      const message = error?.message || 'Could not select photos.';
      await this.showError(String(message));
    }
  }

  private async appendSelectedFiles(files: ExpenseUploadFile[]): Promise<void> {
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

  private openCameraPicker(): Promise<ExpenseUploadFile[]> {
    return new Promise((resolve, reject) => {
      try {
        if (!UIImagePickerController.isSourceTypeAvailable(UIImagePickerControllerSourceType.Camera)) {
          reject(new Error('Camera is not available on this device.'));
          return;
        }

        const visibleViewController = this.getVisibleViewController();
        if (!visibleViewController) {
          reject(new Error('Could not present camera.'));
          return;
        }

        const picker = UIImagePickerController.new();
        picker.sourceType = UIImagePickerControllerSourceType.Camera;
        picker.mediaTypes = NSArray.arrayWithObject('public.image');
        picker.allowsEditing = false;

        const delegate = this.createImagePickerDelegate(resolve, reject);
        this.imagePickerDelegate = delegate;
        picker.delegate = delegate;
        visibleViewController.presentViewControllerAnimatedCompletion(picker, true, null);
      } catch (error) {
        reject(error);
      }
    });
  }

  private openPhotoLibraryPicker(): Promise<ExpenseUploadFile[]> {
    return new Promise((resolve, reject) => {
      try {
        if (!UIImagePickerController.isSourceTypeAvailable(UIImagePickerControllerSourceType.PhotoLibrary)) {
          reject(new Error('Photos are not available on this device.'));
          return;
        }

        const visibleViewController = this.getVisibleViewController();
        if (!visibleViewController) {
          reject(new Error('Could not present photo library.'));
          return;
        }

        const picker = UIImagePickerController.new();
        picker.sourceType = UIImagePickerControllerSourceType.PhotoLibrary;
        picker.mediaTypes = NSArray.arrayWithObject('public.image');
        picker.allowsEditing = false;

        const delegate = this.createImagePickerDelegate(resolve, reject);
        this.imagePickerDelegate = delegate;
        picker.delegate = delegate;
        visibleViewController.presentViewControllerAnimatedCompletion(picker, true, null);
      } catch (error) {
        reject(error);
      }
    });
  }

  private openAttachmentSourceMenu(sourceView?: UIView): void {
    const visibleViewController = this.getVisibleViewController();
    if (!visibleViewController) {
      this.showError('Could not present attachment options.');
      return;
    }

    const alertController = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      'Attach',
      'Choose attachment source',
      UIAlertControllerStyle.ActionSheet
    );

    alertController.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Camera', UIAlertActionStyle.Default, () => {
        void this.takePhoto();
      })
    );

    alertController.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Photos', UIAlertActionStyle.Default, () => {
        void this.pickPhotos();
      })
    );

    alertController.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Files', UIAlertActionStyle.Default, () => {
        void this.pickDocuments();
      })
    );

    alertController.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, null)
    );

    const popover = alertController.popoverPresentationController;
    if (popover) {
      popover.sourceView = sourceView || visibleViewController.view;
      popover.sourceRect = sourceView
        ? sourceView.bounds
        : CGRectMake(
            visibleViewController.view.bounds.size.width / 2,
            visibleViewController.view.bounds.size.height / 2,
            1,
            1
          );
      popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
    }

    visibleViewController.presentViewControllerAnimatedCompletion(alertController, true, null);
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

  private createImagePickerDelegate(
    resolver: (files: ExpenseUploadFile[]) => void,
    rejecter: (error: any) => void
  ): UIImagePickerControllerDelegate & UINavigationControllerDelegate {
    const owner = new WeakRef(this);
    const DelegateClass = (NSObject as any).extend(
      {
        imagePickerControllerDidCancel(controller: UIImagePickerController) {
          controller.dismissViewControllerAnimatedCompletion(true, null);
          resolver([]);
        },

        imagePickerControllerDidFinishPickingMediaWithInfo(
          controller: UIImagePickerController,
          info: NSDictionary<any, any>
        ) {
          controller.dismissViewControllerAnimatedCompletion(true, null);
          const component = owner.deref();
          if (!component) {
            resolver([]);
            return;
          }

          const file = component.createCapturedImageFile(info);
          resolver(file ? [file] : []);
        },
      },
      {
        protocols: [UIImagePickerControllerDelegate, UINavigationControllerDelegate],
        name: 'ExpenseImagePickerDelegateImpl',
      }
    );

    return DelegateClass.new() as UIImagePickerControllerDelegate & UINavigationControllerDelegate;
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

  private createCapturedImageFile(info: NSDictionary<any, any>): ExpenseUploadFile | null {
    const image =
      info?.objectForKey(UIImagePickerControllerOriginalImage) ||
      info?.objectForKey(UIImagePickerControllerEditedImage);
    if (!image) {
      return null;
    }

    const fileName = `photo-${Date.now()}.jpg`;
    const tempPath = path.join(knownFolders.temp().path, fileName);
    const imageData = UIImageJPEGRepresentation(image, 0.9);
    if (!imageData) {
      return null;
    }

    imageData.writeToFileAtomically(tempPath, true);
    const savedFile = File.fromPath(tempPath);
    return {
      name: fileName,
      path: tempPath,
      size: Number(savedFile.size || 0),
      mimeType: 'image/jpeg',
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
        this.syncInitialCategorySelection();
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
        this.syncInitialCategorySelection();
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

    const desiredExpenseTypeId = Number(
      this.expenseForm.controls.expenseTypeId.value ||
      this.existingExpense?.expenseTypeId ||
      this.existingExpense?.expenseType?.id ||
      0
    );
    const desiredIndex = this.expenseTypes.findIndex((type: any) => Number(type?.id || 0) === desiredExpenseTypeId);

    if (this.expenseTypes.length) {
      this.selectedTypeIndex = desiredIndex >= 0 ? desiredIndex : 0;
      this.expenseForm.controls.expenseTypeId.setValue(Number(this.expenseTypes[this.selectedTypeIndex]?.id || 0));
    } else {
      this.selectedTypeIndex = 0;
      this.expenseForm.controls.expenseTypeId.setValue(0);
    }

    if (this.viewReady) {
      this.cdr.detectChanges();
    }
  }

  private hydrateExistingExpense(): void {
    if (!this.isEditMode) {
      return;
    }

    this.noteText = String(this.existingExpense?.notes || '');
    this.amount = Number(this.existingExpense?.amount || 0);
    this.amountText = this.formatPriceInput(this.amount);
    this.expenseForm.controls.amount.setValue(this.amountText);
    this.expenseForm.controls.expenseTypeId.setValue(
      Number(this.existingExpense?.expenseTypeId || this.existingExpense?.expenseType?.id || 0)
    );
  }

  private syncInitialCategorySelection(): void {
    if (!this.isEditMode || !this.expenseCategories.length || !this.allExpenseTypes.length) {
      if (!this.expenseCategories.length) {
        return;
      }
      this.selectedCategoryIndex = this.selectedCategoryIndex || 0;
      return;
    }

    const expenseTypeId = Number(this.existingExpense?.expenseTypeId || this.existingExpense?.expenseType?.id || 0);
    const selectedType = this.allExpenseTypes.find((type: any) => Number(type?.id || 0) === expenseTypeId);
    const categoryId = Number(selectedType?.expenseCategoryId ?? selectedType?.categoryId ?? 0);
    const nextIndex = this.expenseCategories.findIndex((category: any) => Number(category?.id || 0) === categoryId);
    this.selectedCategoryIndex = nextIndex >= 0 ? nextIndex : 0;
  }
}
