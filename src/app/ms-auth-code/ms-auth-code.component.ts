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
  private _codeText = '';
  public get codeText(): string {
    return this._codeText;
  }
  public set codeText(value: string) {
    const digitsOnly = String(value ?? '').replace(/\D+/g, '').slice(0, 6);
    this._codeText = digitsOnly;
    if (String(this.form.controls.code.value ?? '') !== digitsOnly) {
      this.form.controls.code.setValue(digitsOnly, { emitEvent: false });
    }
  }
  public form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  private originalIosShouldChange?: (textField: UITextField, range: NSRange, replacementString: string) => boolean;

  constructor(private modalParams: ModalDialogParams, private loginService: LoginService) { }

  public close(): void {
    this.modalParams.closeCallback(null);
  }

  public verify(): void {
    const sanitized = String(this.codeText ?? '').replace(/\D+/g, '').slice(0, 6);
    if (sanitized !== this.form.controls.code.value) {
      this.form.controls.code.setValue(sanitized);
    }
    this.codeText = sanitized;

    if (!this.form.valid || !sanitized) {
      this.form.markAllAsTouched();
      return;
    }

    const code = sanitized.trim();

    this.loginService.validateCode(this.modalParams.context.data, code).subscribe({
      next: res => {
        console.log(res);
      },
      error: error => {
        console.log(error);
      }
    });
  }

  public onCodeFieldLoaded(args: any): void {
    const field = args?.object as any;
    if (!field || !field.ios || typeof field.textFieldShouldChangeCharactersInRangeReplacementString !== 'function') {
      return;
    }

    if (!this.originalIosShouldChange) {
      this.originalIosShouldChange = field.textFieldShouldChangeCharactersInRangeReplacementString.bind(field);
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
      if (!/^\d{0,6}$/.test(nextText)) {
        return false;
      }

      return this.originalIosShouldChange
        ? this.originalIosShouldChange(textField, range, replacementString)
        : true;
    };
  }

}
