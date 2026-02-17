import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'app-wifi-config',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './wifi-config.component.html',
  styleUrl: './wifi-config.component.scss',
})
export class WifiConfigComponent {
  constructor(private modalParams: ModalDialogParams) {}

  public closeModal(): void {
    this.modalParams.closeCallback();
  }
}
