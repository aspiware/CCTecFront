import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { EzeeFinalizeReason, EzeeOrderListItem } from './ezee-order.model';

@Component({
  standalone: true,
  selector: 'app-ezee-finalize-order',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-finalize-order.component.html',
  styleUrl: './ezee-finalize-order.component.scss',
})
export class EzeeFinalizeOrderComponent {
  public order: EzeeOrderListItem;
  public reasons: EzeeFinalizeReason[] = [];
  public selectedReason: EzeeFinalizeReason | null = null;

  public constructor(private modalParams: ModalDialogParams) {
    const context = this.modalParams.context || {};
    this.order = context.order || ({} as EzeeOrderListItem);
    this.reasons = Array.isArray(this.order.finalizeOptions?.reasons)
      ? this.order.finalizeOptions.reasons
      : [];

    const selectedReasonId = Number(context.selectedReasonId);
    this.selectedReason = this.reasons.find(
      (reason) => reason.reasonId === selectedReasonId
    ) || null;
  }

  public selectReason(reason: EzeeFinalizeReason): void {
    this.selectedReason = reason;
  }

  public isSelected(reason: EzeeFinalizeReason): boolean {
    return this.selectedReason?.reasonId === reason.reasonId;
  }

  public cancel(): void {
    this.modalParams.closeCallback();
  }

  public continue(): void {
    if (!this.selectedReason) {
      return;
    }
    this.modalParams.closeCallback(this.selectedReason);
  }
}
