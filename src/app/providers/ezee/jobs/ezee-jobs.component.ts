import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { EzeeOrdersComponent } from '../orders/ezee-orders.component';

@Component({
  standalone: true,
  selector: 'app-ezee-jobs',
  imports: [NativeScriptCommonModule, EzeeOrdersComponent],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-jobs.component.html',
  styleUrl: '../ezee-page.scss',
})
export class EzeeJobsComponent {}
