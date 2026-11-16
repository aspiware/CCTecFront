import { ChangeDetectorRef, Component, ElementRef, NO_ERRORS_SCHEMA, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { ModalDialogService, NativeScriptCommonModule, NativeScriptFormsModule, RouterExtensions } from '@nativescript/angular';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoginService } from './login.service';
import { setNumber, setString } from '@nativescript/core/application-settings';
import { Application, Page, alert } from '@nativescript/core';
import { UsersService } from '../shared/services/users.service';
import { UserModel } from '../shared/models/user.model';
import { ConfigService } from '../shared/services/config.service';
import { SubscriptionService } from '../shared/services/subscription.service';
import { MsAuthCodeComponent } from '../ms-auth-code/ms-auth-code.component';
import { SegmentedBarItem } from '@nativescript/core';
import { MsAuthPushComponent } from '../ms-auth-push/ms-auth-push.component';
import { ProviderId, ProviderService } from '../shared/services/provider.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, ReactiveFormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public showPass = false;
  public providerItems: SegmentedBarItem[] = [];
  public selectedProviderIndex = 0;
  public authMethodItems: SegmentedBarItem[] = [];
  public selectedAuthMethodIndex = 0;
  public loginForm = new FormGroup({
    provider: new FormControl<ProviderId>('xfinity', { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    authMethodId: new FormControl('PhoneAppOTP', { nonNullable: true }),
  });
  public isBusy = false;
  @ViewChild('passwordInput', { static: false })
  private passwordInputRef?: ElementRef;
  private redirectTo = '/tabs';
  private appearanceChangedHandler?: (args: unknown) => void;
  private signupResponse = {};

  constructor(
    private loginService: LoginService,
    private usersService: UsersService,
    private configService: ConfigService,
    private subscriptionService: SubscriptionService,
    private providerService: ProviderService,
    private routerExtensions: RouterExtensions,
    private route: ActivatedRoute,
    private page: Page,
    private vcRef: ViewContainerRef,
    private modalService: ModalDialogService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.syncTheme();
    this.providerItems = ['Xfinity', 'Ezee Fiber'].map((label) => {
      const item = new SegmentedBarItem();
      item.title = label;
      return item;
    });
    const savedProvider = this.providerService.provider;
    if (savedProvider === 'ezee-fiber') {
      this.selectedProviderIndex = 1;
      this.loginForm.controls.provider.setValue(savedProvider);
    }
    this.authMethodItems = ['OTP Code', 'Push', 'SMS'].map((label) => {
      const item = new SegmentedBarItem();
      item.title = label;
      return item;
    });
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
    this.passwordInputRef?.nativeElement?.focus?.();
  }

  public get isXfinityProvider(): boolean {
    return this.loginForm.controls.provider.value === 'xfinity';
  }

  public onProviderChanged(event: any): void {
    const index = Number(event?.value);
    if (Number.isNaN(index) || index < 0 || index > 1) {
      return;
    }

    this.selectedProviderIndex = index;
    const provider: ProviderId = index === 1 ? 'ezee-fiber' : 'xfinity';
    this.loginForm.controls.provider.setValue(provider);
  }

  public login(): void {
    if (this.isBusy) {
      return;
    }

    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const username = String(this.loginForm.controls.username.value || '').trim().toLowerCase();
    const password = String(this.loginForm.controls.password.value || '');
    const authMethodId = this.loginForm.controls.authMethodId.value;

    if ((username === 'demo' || username === 'demoexpired') && password === 'Demo123!') {
      this.loginDemoUser(username);
      return;
    }

    if (this.loginForm.controls.provider.value === 'ezee-fiber') {
      this.loginEzeeFiber(username, password);
      return;
    }

    this.isBusy = true;
    this.cdr.detectChanges();

    this.loginService.authorize(username, password, authMethodId).subscribe({
      next: (response: any) => {
        console.log('SIGNUP RESPONSE', response);
        this.signupResponse = response;

        if (authMethodId === 'PhoneAppNotification') {
          this.showPushValidationModal(username, password);
          return;
        }
        this.showCodeInputModal(username, password);
      },
      error: async (error) => {
        console.log("ERROR LOGIN", error?.error);
        this.isBusy = false;
        this.cdr.detectChanges();
        const message =
          error?.error?.response ||
          error?.error?.message ||
          error?.message ||
          'Login failed.';
        await alert({
          title: 'Login failed',
          message: String(message),
          okButtonText: 'OK',
        });
      }
    });

  }

  public onAuthMethodChanged(event: any): void {
    const index = Number(event?.value);
    if (Number.isNaN(index) || index < 0 || index > 2) {
      return;
    }
    this.selectedAuthMethodIndex = index;
    if (index === 1) {
      this.loginForm.controls.authMethodId.setValue('PhoneAppNotification');
      return;
    }
    if (index === 2) {
      this.loginForm.controls.authMethodId.setValue('OneWaySMS');
      return;
    }
    this.loginForm.controls.authMethodId.setValue('PhoneAppOTP');
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
        this.completeSignup(username, password, res);
      } else {
        this.isBusy = false;
        this.cdr.detectChanges();
      }
    }).catch(() => {
      this.isBusy = false;
      this.cdr.detectChanges();
    });
  }

  public showPushValidationModal(username: string, password: string): void {
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

    this.modalService.showModal(MsAuthPushComponent, options).then((res) => {
      if (res) {
        this.completeSignup(username, password, res);
      } else {
        this.isBusy = false;
        this.cdr.detectChanges();
      }
    }).catch(() => {
      this.isBusy = false;
      this.cdr.detectChanges();
    });
  }

  private completeSignup(username: string, password: string, tokens: any): void {
    this.loginService.signup(username, password, tokens.access_token, tokens.refresh_token, tokens.id_token).subscribe({
      next: async (res) => {
        console.log(res);

        if (res.error) {
          this.isBusy = false;
          this.cdr.detectChanges();
          const message = res.error?.error?.message || res.error?.message || 'Login failed.';
          await alert({
            title: 'Login',
            message,
            okButtonText: 'OK',
          });

          return;
        }

        this.completeLogin(res.data);
      }, error: async (error) => {
        console.log(error);
        this.isBusy = false;
        this.cdr.detectChanges();

        const message =
          error?.error?.message ||
          error?.error?.error?.message ||
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

  private loginDemoUser(username: string): void {
    const isExpiredDemo = username === 'demoexpired';
    const demoUser = (isExpiredDemo
      ? this.usersService.buildExpiredDemoUser()
      : this.usersService.buildDemoUser()) as any;
    setString("token", String(demoUser.token || 'demo-token'));
    setString("user", JSON.stringify(demoUser));
    this.usersService.setUser(demoUser as UserModel);
    setNumber("userId", Number(demoUser.userId || 999999));
    setNumber("roleId", Number(demoUser.roleId || 2));
    setNumber("settingId", Number(demoUser.settingId || 999999));
    setString("bp", String(demoUser.bp || 'demo'));
    this.providerService.setProvider(this.loginForm.controls.provider.value);
    this.subscriptionService.setLocalStatus(!isExpiredDemo);
    this.configService.login();
    this.isBusy = false;
    this.navigateToProviderHome();
  }

  private loginEzeeFiber(username: string, password: string): void {
    this.isBusy = true;
    this.cdr.detectChanges();

    this.loginService.loginEzeeFiber(username, password).subscribe({
      next: async (res: any) => {
        if (res?.error) {
          this.isBusy = false;
          this.cdr.detectChanges();
          await alert({
            title: 'Login',
            message: String(res?.message || 'Login failed.'),
            okButtonText: 'OK',
          });
          return;
        }

        const data = res?.data?.user
          ? { ...res.data.user, token: res.data.token || res.data.user.token }
          : (res?.data || res);
        const session = {
          ...data,
          userId: Number(data?.userId || data?.id || 0),
        };

        if (!session?.token || !session?.userId) {
          this.isBusy = false;
          this.cdr.detectChanges();
          await alert({
            title: 'Login',
            message: 'The Ezee Fiber login response is incomplete.',
            okButtonText: 'OK',
          });
          return;
        }

        this.completeLogin(session);
      },
      error: async (error) => {
        this.isBusy = false;
        this.cdr.detectChanges();
        const message =
          error?.error?.message ||
          error?.error?.error?.message ||
          error?.message ||
          'Login failed.';
        await alert({
          title: 'Login',
          message: String(message),
          okButtonText: 'OK',
        });
      },
    });
  }

  private completeLogin(session: any): void {
    this.providerService.setProvider(this.loginForm.controls.provider.value);
    setString('token', String(session.token));
    setString('user', JSON.stringify(session));
    this.usersService.setUser(session as UserModel);
    setNumber('userId', Number(session.userId || 0));
    setNumber('roleId', Number(session.roleId || 0));
    setNumber('settingId', Number(session.settingId || 0));
    setString('bp', String(session.bp || ''));

    this.configService.login();
    this.isBusy = false;
    this.navigateToProviderHome();
  }

  private navigateToProviderHome(): void {
    this.routerExtensions.navigate([this.providerService.getHomeRoute()], { clearHistory: true });
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
