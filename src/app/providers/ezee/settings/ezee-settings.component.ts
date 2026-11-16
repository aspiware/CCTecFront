import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { ConfigService } from '../../../shared/services/config.service';

@Component({
  standalone: true,
  selector: 'app-ezee-settings',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-settings.component.html',
  styleUrl: '../ezee-page.scss',
})
export class EzeeSettingsComponent {
  constructor(
    private configService: ConfigService,
    private routerExtensions: RouterExtensions
  ) {}

  public logout(): void {
    this.configService.logout();
    this.routerExtensions.navigate(['/login'], { clearHistory: true });
  }
}
