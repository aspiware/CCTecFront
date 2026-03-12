import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'app-business-job-prices',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './business-job-prices.component.html',
  styleUrl: './business-job-prices.component.scss',
})
export class BusinessJobPricesComponent {}
