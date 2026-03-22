import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Utils } from '@nativescript/core';

@Component({
  standalone: true,
  selector: 'app-force-update',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './force-update.component.html',
  styleUrl: './force-update.component.scss',
})
export class ForceUpdateComponent {
  public localVersion = '';
  public storeVersion = '';
  public appStoreUrl = '';

  constructor(private modalParams: ModalDialogParams) {
    const context = this.modalParams.context || {};
    this.localVersion = String(context?.localVersion || '').trim();
    this.storeVersion = String(context?.storeVersion || '').trim();
    this.appStoreUrl = String(context?.appStoreUrl || '').trim();
  }

  public openUpdate(): void {
    if (!this.appStoreUrl) {
      return;
    }
    Utils.openUrl(this.appStoreUrl);
  }
}
