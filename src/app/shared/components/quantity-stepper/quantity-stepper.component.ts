import { Component, EventEmitter, Input, NO_ERRORS_SCHEMA, Output } from '@angular/core';
import { NativeScriptCommonModule, NativeScriptFormsModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'app-quantity-stepper',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './quantity-stepper.component.html',
  styleUrl: './quantity-stepper.component.scss',
})
export class QuantityStepperComponent {
  @Input() label = '';
  @Input() value = 0;
  @Input() min = 0;
  @Input() max = 99;
  @Input() step = 1;
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<number>();

  public decrement(): void {
    if (this.disabled) {
      return;
    }
    this.emitClamped(this.value - this.step);
  }

  public increment(): void {
    if (this.disabled) {
      return;
    }
    this.emitClamped(this.value + this.step);
  }

  public onTextChange(value: string): void {
    if (this.disabled) {
      return;
    }
    const normalized = String(value || '').replace(/[^\d-]/g, '');
    const parsed = Number(normalized);
    this.emitClamped(Number.isNaN(parsed) ? this.min : parsed);
  }

  private emitClamped(next: number): void {
    const clamped = Math.min(this.max, Math.max(this.min, Number(next || 0)));
    this.value = clamped;
    this.valueChange.emit(clamped);
  }
}
