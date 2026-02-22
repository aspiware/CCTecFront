import { Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule, NativeScriptFormsModule, RouterExtensions } from '@nativescript/angular';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoginService } from './login.service';
import { getString, setBoolean, setNumber, setString } from '@nativescript/core/application-settings';
import { Application, Page, alert } from '@nativescript/core';
import { UsersService } from '../shared/services/users.service';
import { UserModel } from '../shared/models/user.model';
import { ConfigService } from '../shared/services/config.service';

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
  public loginForm = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    authMethodId: new FormControl(false, { nonNullable: true }),
  });
  public isBusy = false;
  private redirectTo = '/tabs';
  private appearanceChangedHandler?: (args: unknown) => void;

  constructor(
    private loginService: LoginService,
    private usersService: UsersService,
    private configService: ConfigService,
    private routerExtensions: RouterExtensions,
    private route: ActivatedRoute,
    private page: Page
  ) {}

  ngOnInit(): void {
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

    const username = this.loginForm.controls.username.value.trim().toLowerCase();
    const password = this.loginForm.controls.password.value;
    this.isBusy = true;

    this.loginService.login(username, password).subscribe({
      next: (response: any) => {
        const data = response?.data || response;
        setString('token', String(data?.token || ''));
        setString('user', JSON.stringify(data || {}));
        this.usersService.setUser(<UserModel>JSON.parse(getString('user', '{}')));
        setNumber('userId', Number(data?.userId || 0));
        setNumber('roleId', Number(data?.roleId || 0));
        setNumber('settingId', Number(data?.settingId || 0));
        setString('bp', String(data?.bp || ''));
        setBoolean('isLoggedIn', true);
        this.configService.login();
        this.isBusy = false;
        this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
      },
      error: async (error) => {
        this.isBusy = false;
        const message = error?.error?.message || error?.message || 'Login failed.';
        await alert({
          title: 'Login',
          message,
          okButtonText: 'OK',
        });
      },
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
