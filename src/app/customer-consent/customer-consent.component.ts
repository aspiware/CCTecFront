import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'app-customer-consent',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './customer-consent.component.html',
  styleUrl: './customer-consent.component.scss',
})
export class CustomerConsentComponent {
  public url = 'https://www.xfinity.com/approval';
}
