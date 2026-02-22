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
  public form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor(private modalParams: ModalDialogParams, private loginService: LoginService) { }

  public close(): void {
    this.modalParams.closeCallback(null);
  }

  public verify(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const code = this.form.controls.code.value.trim()

    this.loginService.validateCode(this.modalParams.context.data, code).subscribe({
      next: res => {
        console.log(res);
      },
      error: error => {
        console.log(error);
      }
    });
  }

}
