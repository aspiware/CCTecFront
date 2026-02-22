import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalDialogParams, NativeScriptCommonModule, NativeScriptFormsModule } from '@nativescript/angular';
import { Application, isAndroid, isIOS } from '@nativescript/core';
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
  public codeTouched = false;
  public codeText = '';
  public isCodeFocused = false;
  public form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  private hiddenCodeField: any;
  private originalIosShouldChange?: (textField: UITextField, range: NSRange, replacementString: string) => boolean;

  constructor(private modalParams: ModalDialogParams, private loginService: LoginService) { }

  public close(): void {
    this.modalParams.closeCallback(null);
  }

  public verify(): void {
    this.codeTouched = true;
    const code = String(this.codeText || '').replace(/\D+/g, '').slice(0, 6);
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

  public getDigit(index: number): string {
    return this.codeText[index] || '';
  }

  public getDigitDisplay(index: number): string {
    return this.getDigit(index);
  }

  public isActiveDigit(index: number): boolean {
    if (!this.isCodeFocused) {
      return false;
    }

    const activeIndex = Math.min(this.codeText.length, this.digitIndexes.length - 1);
    return index === activeIndex;
  }

  public focusCodeInput(): void {
    this.hiddenCodeField?.focus?.();
  }

  public async pasteCodeFromClipboard(): Promise<void> {
    try {
      const clipboardText = this.readClipboardText();
      const digitsOnly = String(clipboardText ?? '').replace(/\D+/g, '').slice(0, 6);
      if (!digitsOnly) {
        return;
      }

      this.codeText = digitsOnly;
      this.form.controls.code.setValue(this.codeText, { emitEvent: false });
      this.codeTouched = true;
      this.hiddenCodeField?.focus?.();
    } catch (error) {
      console.log('[MsAuthCode] Clipboard paste error:', error);
    }
  }

  private readClipboardText(): string {
    if (isIOS) {
      return String(UIPasteboard.generalPasteboard.string || '');
    }

    if (isAndroid) {
      const context = Application.android.context;
      const clipboard = context?.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager;
      if (!clipboard?.hasPrimaryClip()) {
        return '';
      }

      const clip = clipboard.getPrimaryClip();
      if (!clip || clip.getItemCount() < 1) {
        return '';
      }

      return String(clip.getItemAt(0).coerceToText(context) || '');
    }

    return '';
  }

  public onHiddenCodeLoaded(args: any): void {
    this.hiddenCodeField = args?.object;
    this.attachIosDigitFilter(this.hiddenCodeField);
  }

  public onHiddenCodeFocus(): void {
    this.isCodeFocused = true;
  }

  public onHiddenCodeBlur(): void {
    this.isCodeFocused = false;
  }

  public onHiddenCodeTextChange(args: any): void {
    const raw = String(args?.object?.text ?? args?.value ?? '');
    const digitsOnly = raw.replace(/\D+/g, '').slice(0, 6);
    if (args?.object && String(args.object.text ?? '') !== digitsOnly) {
      args.object.text = digitsOnly;
    }
    this.codeText = digitsOnly;
    this.form.controls.code.setValue(this.codeText, { emitEvent: false });
  }

  private attachIosDigitFilter(field: any): void {
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
