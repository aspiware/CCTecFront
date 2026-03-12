import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'app-fiber-job-prices',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './fiber-job-prices.component.html',
  styleUrl: './fiber-job-prices.component.scss',
})
export class FiberJobPricesComponent {}
