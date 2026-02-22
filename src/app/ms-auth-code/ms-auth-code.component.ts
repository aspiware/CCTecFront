import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalDialogParams, NativeScriptCommonModule, NativeScriptFormsModule } from '@nativescript/angular';
import { LoginService } from '../login/login.service';

@Component({
  standalone: true,
  selector: 'app-ms-auth-code',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, ReactiveFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ms-auth-code.component.html',
  styleUrl: './ms-auth-code.component.scss',
})
export class MsAuthCodeComponent {
  public readonly digitIndexes = [0, 1, 2, 3, 4, 5];
  public codeDigits = ['', '', '', '', '', ''];
  public codeTouched = false;
  public form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  private digitFields: any[] = [];
  private originalIosShouldChange = new Map<any, (textField: UITextField, range: NSRange, replacementString: string) => boolean>();

  public get codeValue(): string {
    return this.codeDigits.join('');
  }

  constructor(private modalParams: ModalDialogParams, private loginService: LoginService) { }

  public close(): void {
    this.modalParams.closeCallback(null);
  }

  public verify(): void {
    this.codeTouched = true;
    const code = this.codeValue.replace(/\D+/g, '').slice(0, 6);
    this.form.controls.code.setValue(code, { emitEvent: false });

    if (code.length !== 6) {
      return;
    }

    this.loginService.validateCode(this.modalParams.context.data, code).subscribe({
      next: res => {
        console.log(res);
      },
      error: error => {
        console.log(error);
      }
    });
  }

  public onDigitLoaded(index: number, args: any): void {
    this.digitFields[index] = args?.object;
    this.attachIosDigitFilter(args?.object);
  }

  public onDigitTextChange(index: number, args: any): void {
    const raw = String(args?.object?.text ?? args?.value ?? '');
    const digitsOnly = raw.replace(/\D+/g, '');
    const digit = digitsOnly ? digitsOnly.charAt(digitsOnly.length - 1) : '';

    if (args?.object && String(args.object.text ?? '') !== digit) {
      args.object.text = digit;
    }

    if (this.codeDigits[index] !== digit) {
      this.codeDigits[index] = digit;
      this.form.controls.code.setValue(this.codeValue, { emitEvent: false });
    }

    if (digit && index < this.digitIndexes.length - 1) {
      setTimeout(() => this.focusDigit(index + 1), 0);
    }
  }

  public onDigitReturn(index: number): void {
    if (index < this.digitIndexes.length - 1) {
      this.focusDigit(index + 1);
      return;
    }
    this.verify();
  }

  private focusDigit(index: number): void {
    this.digitFields[index]?.focus?.();
  }

  private attachIosDigitFilter(field: any): void {
    if (!field || !field.ios || typeof field.textFieldShouldChangeCharactersInRangeReplacementString !== 'function') {
      return;
    }

    if (!this.originalIosShouldChange.has(field)) {
      this.originalIosShouldChange.set(
        field,
        field.textFieldShouldChangeCharactersInRangeReplacementString.bind(field)
      );
    }

    field.textFieldShouldChangeCharactersInRangeReplacementString = (
      textField: UITextField,
      range: NSRange,
      replacementString: string
    ): boolean => {
      const current = String(textField.text || '');
      const nsCurrent = NSString.stringWithString(current);
      const nextText = String(
        nsCurrent.stringByReplacingCharactersInRangeWithString(range, replacementString || '')
      );
      if (!/^\d{0,1}$/.test(nextText)) {
        return false;
      }

      const original = this.originalIosShouldChange.get(field);
      return original ? original(textField, range, replacementString) : true;
    };
  }

}
