import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Application, alert } from '@nativescript/core';
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
export class MsAuthPushComponent implements OnInit, OnDestroy {
  public isVerifying = false;
  private wasBackgrounded = false;
  private isAlertOpen = false;
  private readonly onAppSuspend = () => {
    this.wasBackgrounded = true;
    this.dismissOpenAlertIfNeeded();
  };
  private readonly onAppResume = () => {
    if (!this.wasBackgrounded) {
      return;
    }
    this.wasBackgrounded = false;
    this.validate();
  };

  constructor(
    private modalParams: ModalDialogParams,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    Application.on(Application.suspendEvent, this.onAppSuspend);
    Application.on(Application.resumeEvent, this.onAppResume);
  }

  ngOnDestroy(): void {
    Application.off(Application.suspendEvent, this.onAppSuspend);
    Application.off(Application.resumeEvent, this.onAppResume);
  }

  public get entropyText(): string {
    return String(this.modalParams.context?.data?.entropy ?? '-');
  }

  public validate(): void {
    if (this.isVerifying) {
      return;
    }

    this.isVerifying = true;
    this.cdr.detectChanges();
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

          if(res?.access_token){
            this.modalParams.closeCallback(res);
            return;
          }

          switch (res?.ResultValue) {
            case 'AuthenticationPending':
              await this.showAlert(
                'Verification',
                'Please confirm the number in the Authenticator app.'
              );
              break;
            case 'PhoneAppEntropyIncorrect':
              await this.showAlert(
                'Verification',
                'The number entered in the Authenticator app did not match. Please try again.'
              );
              this.modalParams.closeCallback();
              break;
            case 'PhoneAppDenied':
              await this.showAlert('Verification', 'The request was denied. Please try again.');
              this.modalParams.closeCallback();
              break;
            default:
              await this.showAlert(
                'Verification',
                'An error occurred while generating the number. Try again.'
              );
              this.modalParams.closeCallback();
              break;
          }
        },
        error: async (error) => {
          const message =
            error?.error?.response ||
            error?.error?.message ||
            error?.message ||
            'Unable to validate push sign-in.';
          await this.showAlert('Verification', String(message));
        },
      });
  }

  public close(): void {
    this.modalParams.closeCallback(null);
  }

  private async showAlert(title: string, message: string): Promise<void> {
    this.isAlertOpen = true;
    try {
      await alert({
        title,
        message,
        okButtonText: 'OK',
      });
    } finally {
      this.isAlertOpen = false;
    }
  }

  private dismissOpenAlertIfNeeded(): void {
    if (!this.isAlertOpen || !__IOS__) {
      return;
    }

    let viewController = Application.ios?.rootController;
    while (
      viewController?.presentedViewController &&
      !viewController.presentedViewController.beingDismissed
    ) {
      viewController = viewController.presentedViewController;
    }

    if (viewController instanceof UIAlertController) {
      viewController.dismissViewControllerAnimatedCompletion(true, null);
      this.isAlertOpen = false;
    }
  }
}
