import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { alert } from '@nativescript/core';
import { finalize } from 'rxjs/operators';
import { LoginService } from '../login/login.service';

@Component({
  standalone: true,
  selector: 'app-ms-auth-push',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ms-auth-push.component.html',
  styleUrl: './ms-auth-push.component.scss',
})
export class MsAuthPushComponent {
  public isVerifying = false;

  constructor(
    private modalParams: ModalDialogParams,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) { }

  public get entropyText(): string {
    return String(this.modalParams.context?.data?.entropy ?? '-');
  }

  public validate(): void {
    if (this.isVerifying) {
      return;
    }

    this.isVerifying = true;
    this.loginService
      .validatePush(this.modalParams.context?.data, this.entropyText)
      .pipe(
        finalize(() => {
          this.isVerifying = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: async (res) => {
          console.log(res);

          switch (res?.ResultValue) {
            case 'AuthenticationPending':
              await alert({
                title: 'Verification',
                message: 'Please confirm the number in the Authenticator app.',
                okButtonText: 'OK',
              });
              break;
            case 'PhoneAppEntropyIncorrect':
              await alert({
                title: 'Verification',
                message: 'The number entered in the Authenticator app did not match. Please try again.',
                okButtonText: 'OK',
              });
              this.modalParams.closeCallback();
              break;
            case 'PhoneAppDenied':
              await alert({
                title: 'Verification',
                message: 'The request was denied. Please try again.',
                okButtonText: 'OK',
              });
              this.modalParams.closeCallback();
              break;
            default:
               await alert({
                title: 'Verification',
                message: 'An error occurred while generating the number. Try again.',
                okButtonText: 'OK',
              });
              this.modalParams.closeCallback();
              break;
          }

          // this.modalParams.closeCallback(res)
        },
        error: async (error) => {
          const message =
            error?.error?.response ||
            error?.error?.message ||
            error?.message ||
            'Unable to validate push sign-in.';
          await alert({
            title: 'Verification',
            message: String(message),
            okButtonText: 'OK',
          });
        },
      });
  }

    public close(): void {
    this.modalParams.closeCallback(null);
  }
}

