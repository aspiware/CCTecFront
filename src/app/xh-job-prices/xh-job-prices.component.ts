import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'app-xh-job-prices',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './xh-job-prices.component.html',
  styleUrl: './xh-job-prices.component.scss',
})
export class XhJobPricesComponent {}
