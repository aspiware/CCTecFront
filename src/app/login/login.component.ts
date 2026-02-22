import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { ModalDialogService, NativeScriptCommonModule, NativeScriptFormsModule, RouterExtensions } from '@nativescript/angular';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoginService } from './login.service';
import { getString, setBoolean, setNumber, setString } from '@nativescript/core/application-settings';
import { Application, Page, alert } from '@nativescript/core';
import { UsersService } from '../shared/services/users.service';
import { UserModel } from '../shared/models/user.model';
import { ConfigService } from '../shared/services/config.service';
import { MsAuthCodeComponent } from '../ms-auth-code/ms-auth-code.component';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, ReactiveFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  // TEMP: hardcoded credentials for QA testing
  private readonly TEST_BP = 'bp-asuare710';
  private readonly TEST_PASSWORD = 'SuarezPerez1992-2';
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public showPass = false;
  public loginForm = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    authMethodId: new FormControl(false, { nonNullable: true }),
  });
  public isBusy = false;
  private redirectTo = '/tabs';
  private appearanceChangedHandler?: (args: unknown) => void;
  private signupResponse = {};

  constructor(
    private loginService: LoginService,
    private usersService: UsersService,
    private configService: ConfigService,
    private routerExtensions: RouterExtensions,
    private route: ActivatedRoute,
    private page: Page,
    private vcRef: ViewContainerRef,
    private modalService: ModalDialogService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loginForm.patchValue({
      username: this.TEST_BP,
      password: this.TEST_PASSWORD,
    });

    this.syncTheme();
    this.redirectTo = this.route.snapshot.queryParamMap.get('redirect') || '/tabs';
    this.page.backgroundImage = 'res://login_bg';
    this.page.style.backgroundSize = 'cover';
    this.page.style.backgroundRepeat = 'no-repeat';

    this.appearanceChangedHandler = () => this.syncTheme();
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
  }

  ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
  }

  public showHidePass(): void {
    this.showPass = !this.showPass;
  }

  public focusPassword(): void {
    // Reserved for input focus behavior.
  }

  public login(): void {
    if (this.isBusy) {
      return;
    }

    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const username = this.TEST_BP.trim().toLowerCase();
    const password = this.TEST_PASSWORD;
    const authMethodId = this.loginForm.controls.authMethodId.value == true ? 'OneWaySMS' : 'PhoneAppOTP';
    this.isBusy = true;

    this.loginService.authorize(username, password, authMethodId).subscribe({
      next: (response: any) => {
        console.log('SIGNUP RESPONSE', response);
        this.signupResponse = response;

        this.showCodeInputModal(username, password);
      },
      error: async (error) => {
        console.log("ERROR LOGIN", error?.error);
        this.isBusy = false;
        const message =
          error?.error?.response ||
          error?.error?.message ||
          error?.message ||
          'Login failed.';
        await alert({
          title: 'Login',
          message: String(message),
          okButtonText: 'OK',
        });
      }
    });

  }

  public showCodeInputModal(username, password): void {
    // if (!job) {
    //   return;
    // }

    const options: any = {
      context: { data: this.signupResponse },
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom
      },
    };

    this.modalService.showModal(MsAuthCodeComponent, options).then((res) => {
      console.log(res)

      if (res) {
        this.loginService.signup(username, password, res.access_token, res.refresh_token, res.id_token).subscribe({
          next: async (res) => {
            console.log(res);

            if (res.error) {
              this.isBusy = false;
              const message = res.error?.error?.message || res.error?.message || 'Login failed.';
              await alert({
                title: 'Login',
                message,
                okButtonText: 'OK',
              });

              return;
            }

            setString("token", res.data.token);
            setString("user", JSON.stringify(res.data));
            this.usersService.setUser(
              <UserModel>JSON.parse(getString("user", null))
            );
            setNumber("userId", res.data.userId);
            setNumber("roleId", res.data.roleId);
            setNumber("settingId", res.data.settingId);
            setString("bp", res.data.bp);

            this.configService.login();
            this.isBusy = false;
            this.routerExtensions.navigate(['/tabs'], { clearHistory: true });
          }, error: (error) => {
            console.log(error);
          }
        });
      } else {
        this.isBusy = false;
        this.cdr.detectChanges();
      }
    }).catch(() => {
      this.isBusy = false;
      this.cdr.detectChanges();
    });
  }

  private syncTheme(): void {
    const appAppearance = Application.systemAppearance();
    if (appAppearance === 'dark' || appAppearance === 'light') {
      this.isDarkTheme = appAppearance === 'dark';
      return;
    }

    const pageClassName = String(this.page.className || '');
    this.isDarkTheme = pageClassName.includes('ns-dark');
  }
}
