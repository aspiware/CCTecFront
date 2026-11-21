import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import {
  ModalDialogParams,
  NativeScriptCommonModule,
  NativeScriptFormsModule,
} from '@nativescript/angular';
import { alert, isAndroid, isIOS, Utils } from '@nativescript/core';
import { finalize, Subscription } from 'rxjs';
import {
  EzeeOspTicketFields,
  EzeeOrderListItem,
} from './ezee-order.model';
import { EzeeOrdersService } from './ezee-orders.service';

@Component({
  standalone: true,
  selector: 'app-ezee-osp-ticket',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-osp-ticket.component.html',
  styleUrl: './ezee-osp-ticket.component.scss',
})
export class EzeeOspTicketComponent implements OnInit, OnDestroy {
  public readonly order: EzeeOrderListItem;
  public fields: EzeeOspTicketFields = this.emptyFields();
  public preview = '';
  public isLoading = false;
  public errorMessage = '';
  private templateSubscription?: Subscription;
  private dismissKeyboardTimer?: ReturnType<typeof setTimeout>;
  private suppressDismissUntil = 0;

  public constructor(
    private modalParams: ModalDialogParams,
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef
  ) {
    this.order = this.modalParams.context?.order || ({} as EzeeOrderListItem);
  }

  public ngOnInit(): void {
    this.loadTemplate();
  }

  public ngOnDestroy(): void {
    this.templateSubscription?.unsubscribe();
    if (this.dismissKeyboardTimer) {
      clearTimeout(this.dismissKeyboardTimer);
    }
  }

  public close(): void {
    this.modalParams.closeCallback();
  }

  public retry(): void {
    this.loadTemplate();
  }

  public updatePreview(): void {
    this.preview = this.buildTicket();
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

  public copyTicket(): void {
    this.dismissKeyboard();
    this.preview = this.buildTicket();
    Utils.copyToClipboard(this.preview);
    alert({
      title: 'OSP Ticket',
      message: 'Ticket copied to the clipboard.',
      okButtonText: 'OK',
    });
  }

  private loadTemplate(): void {
    if (!this.order?.number || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    this.templateSubscription?.unsubscribe();
    this.templateSubscription = this.ordersService.getOspTicketTemplate(this.order.number).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response?.error) {
          this.errorMessage = response?.message || 'Unable to generate the OSP ticket template.';
          return;
        }
        this.fields = this.normalizeFields(response?.data?.fields);
        this.preview = String(response?.data?.template || this.buildTicket());
      },
      error: (error) => {
        this.errorMessage = String(
          error?.error?.message || error?.message || 'Unable to generate the OSP ticket template.'
        );
      },
    });
  }

  private buildTicket(): string {
    return [
      'OSP Referral Template',
      '',
      `Customer Type: ${this.fields.customerType}`,
      `Node: ${this.fields.node}`,
      `WO #: ${this.fields.workOrderNumber}`,
      `Address: ${this.fields.address}`,
      `Terminal Location: ${this.fields.terminalLocation}`,
      `Issue: ${this.fields.issue}`,
      `Service Date: ${this.fields.serviceDate}`,
      `Date of Test: ${this.fields.dateOfTest}`,
      `Tech: ${this.fields.tech}`,
      `Supervisor: ${this.fields.supervisor}`,
      `Tech notes: ${this.fields.techNotes}`,
    ].join('\n');
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

  private normalizeFields(value: Partial<EzeeOspTicketFields> | null | undefined): EzeeOspTicketFields {
    const defaults = this.emptyFields();
    return Object.keys(defaults).reduce((fields, key) => {
      const field = key as keyof EzeeOspTicketFields;
      fields[field] = String(value?.[field] ?? '');
      return fields;
    }, defaults);
  }

  private emptyFields(): EzeeOspTicketFields {
    return {
      customerType: '',
      node: '',
      workOrderNumber: '',
      address: '',
      terminalLocation: '',
      issue: '',
      serviceDate: '',
      dateOfTest: '',
      tech: '',
      supervisor: '',
      techNotes: '',
    };
  }
}
