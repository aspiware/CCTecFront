import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import {
  ModalDialogParams,
  NativeScriptCommonModule,
  NativeScriptFormsModule,
} from '@nativescript/angular';
import { alert, Application, ApplicationSettings, confirm, isAndroid, isIOS, Utils } from '@nativescript/core';
import { finalize, Subscription } from 'rxjs';
import { MenuButtonAction, MenuEvent } from '../../../shared/components/menu-button';
import { EzeeOrderEquipment, EzeeOrderListItem } from './ezee-order.model';
import { EzeeOrdersService } from './ezee-orders.service';

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
export class EzeeInstallNoteComponent implements OnInit, OnDestroy {
  public readonly order: EzeeOrderListItem;
  public readonly equipmentLocationOptions: MenuButtonAction[] = [
    { name: 'Living Room' },
    { name: 'Bedroom' },
    { name: 'Home Office' },
    { name: 'Basement' },
    { name: 'Garage' },
    { name: 'Utility Room' },
    { name: 'Closet' },
    { name: 'Attic' },
    { name: 'Other' },
  ];
  public readonly fiberInstallationProcessOptions: MenuButtonAction[] = [
    { name: 'Wall Fish' },
    { name: 'Wall Penetration' },
    { name: 'Duct to Attic' },
  ];
  public fields: EzeeInstallNoteFields;
  public preview = '';
  public isLoadingEquipment = false;
  public equipmentErrorMessage = '';
  private equipmentSubscription?: Subscription;
  private dismissKeyboardTimer?: ReturnType<typeof setTimeout>;
  private suppressDismissUntil = 0;

  public constructor(
    private modalParams: ModalDialogParams,
    private cdr: ChangeDetectorRef,
    private ordersService: EzeeOrdersService
  ) {
    this.order = this.modalParams.context?.order || ({} as EzeeOrderListItem);
    this.fields = this.initialFields();
    this.updatePreview();
  }

  public ngOnInit(): void {
    this.loadEquipmentIds();
  }

  public ngOnDestroy(): void {
    this.equipmentSubscription?.unsubscribe();
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
    }
  }

  public close(): void {
    this.modalParams.closeCallback();
  }

  public addNote(): void {
    if (this.isLoadingEquipment) {
      return;
    }
    this.dismissKeyboard();
    this.modalParams.closeCallback(this.buildNote());
  }

  public copyNote(): void {
    this.dismissKeyboard();
    this.updatePreview();
    Utils.copyToClipboard(this.preview);
    alert({
      title: 'Close out Notes',
      message: 'Note copied to the clipboard.',
      okButtonText: 'OK',
    });
  }

  public confirmAddNote(event: any): void {
    if (this.isLoadingEquipment) {
      return;
    }
    this.dismissKeyboard();

    if (isIOS && this.showIosAddNoteConfirmation(event?.object?.ios)) {
      return;
    }
    if (isAndroid && this.showAndroidAddNoteConfirmation(event?.object?.android)) {
      return;
    }

    confirm({
      title: 'Add close out note?',
      message: 'This note will be added to the work order.',
      okButtonText: 'Add',
      cancelButtonText: 'Cancel',
    }).then((confirmed) => {
      if (confirmed) {
        this.addNote();
      }
    });
  }

  public updatePreview(): void {
    this.preview = this.buildNote();
  }

  public selectEquipmentLocation(event: MenuEvent): void {
    this.dismissKeyboard();
    const selected = this.equipmentLocationOptions[event?.index]?.name;
    if (!selected) {
      return;
    }
    this.fields.equipmentLocation = selected;
    this.updatePreview();
    this.cdr.detectChanges();
  }

  public selectFiberInstallationProcess(event: MenuEvent): void {
    this.dismissKeyboard();
    const selected = this.fiberInstallationProcessOptions[event?.index]?.name;
    if (!selected) {
      return;
    }
    this.fields.fiberInstallationProcess = selected;
    this.updatePreview();
    this.cdr.detectChanges();
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
      `Address: ${this.fields.address}`,
      `Pre-Installation Walkthrough, Performed With: ${this.fields.walkthroughPerformedWith}`,
      `Equipment Location: ${this.fields.equipmentLocation}`,
      `Fiber Installation Process: ${this.fields.fiberInstallationProcess}`,
      `Assisted Customer with Router Setup: ${this.yesNo(this.fields.assistedRouterSetup)}`,
      `Eero Speeds: ${this.fields.eeroSpeeds}`,
      `Terminal Splice: ${this.yesNo(this.fields.terminalSplice)}`,
      `NID Splice: ${this.yesNo(this.fields.nidSplice)}`,
      `NID Light Levels: ${this.fields.nidLightLevels}`,
      `ONT Light Levels: ${this.fields.ontLightLevels}`,
      `ONT Serial Number: ${this.fields.ontSerialNumber}`,
      `Eero Serial Number: ${this.fields.eeroSerialNumber}`,
      `Tech notes: ${this.fields.techNotes}`,
      `Tech Name/ID: ${this.fields.techNameId}`,
      `Date: ${this.fields.date}`,
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

  private loadEquipmentIds(): void {
    if (!this.order?.number || this.isLoadingEquipment) {
      return;
    }

    this.isLoadingEquipment = true;
    this.equipmentErrorMessage = '';
    this.equipmentSubscription?.unsubscribe();
    this.equipmentSubscription = this.ordersService.getOrderEquipment(this.order.number).pipe(
      finalize(() => {
        this.isLoadingEquipment = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          this.equipmentErrorMessage = response?.message || 'Unable to load equipment IDs.';
          return;
        }
        const equipment = Array.isArray(response?.data?.equipment)
          ? response.data.equipment
          : [];
        this.fields.ontSerialNumber = this.findEquipmentIds(equipment, /\b(?:ont|onu)\b|modem/i);
        this.fields.eeroSerialNumber = this.findEquipmentIds(equipment, /eero/i);
        this.updatePreview();
      },
      error: (error) => {
        this.equipmentErrorMessage = String(
          error?.error?.message || error?.message || 'Unable to load equipment IDs.'
        );
      },
    });
  }

  private showIosAddNoteConfirmation(sourceButton: UIButton | null | undefined): boolean {
    let viewController = Application.ios?.rootController;
    while (
      viewController?.presentedViewController &&
      !viewController.presentedViewController.beingDismissed
    ) {
      viewController = viewController.presentedViewController;
    }
    if (!viewController) {
      return false;
    }

    const popup = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      'Add close out note?',
      'This note will be added to the work order.',
      UIAlertControllerStyle.ActionSheet
    );
    popup.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Add', UIAlertActionStyle.Default, () => {
        this.addNote();
      })
    );
    popup.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, null)
    );

    const popover = popup.popoverPresentationController;
    if (popover) {
      popover.sourceView = sourceButton || viewController.view;
      popover.sourceRect = sourceButton
        ? sourceButton.bounds
        : CGRectMake(
            viewController.view.bounds.size.width / 2,
            viewController.view.bounds.size.height / 2,
            1,
            1
          );
      popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
    }

    viewController.presentViewControllerAnimatedCompletion(popup, true, null);
    return true;
  }

  private showAndroidAddNoteConfirmation(sourceView: android.view.View | null | undefined): boolean {
    const activity = Application.android.foregroundActivity || Application.android.startActivity;
    if (!activity || !sourceView) {
      return false;
    }

    const addItemId = 1;
    const popup = new android.widget.PopupMenu(activity, sourceView);
    popup.getMenu().add(0, addItemId, 0, 'Add');
    popup.getMenu().add(0, 2, 1, 'Cancel');
    popup.setOnMenuItemClickListener(
      new android.widget.PopupMenu.OnMenuItemClickListener({
        onMenuItemClick: (item): boolean => {
          if (item.getItemId() === addItemId) {
            this.addNote();
          }
          return true;
        },
      })
    );
    popup.show();
    return true;
  }

  private findEquipmentIds(equipment: EzeeOrderEquipment[], modelPattern: RegExp): string {
    const currentEquipment = equipment.filter((item) =>
      !/^remove$/i.test(String(item?.action || '').trim())
    );
    return currentEquipment
      .filter((item) => modelPattern.test(String(item?.model || '')))
      .map((item) => String(item?.id || '').trim())
      .filter((id, index, ids) => !!id && ids.indexOf(id) === index)
      .join(', ');
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
