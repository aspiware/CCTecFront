import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'app-residential-job-prices',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './residential-job-prices.component.html',
  styleUrl: './residential-job-prices.component.scss',
})
export class ResidentialJobPricesComponent {}
