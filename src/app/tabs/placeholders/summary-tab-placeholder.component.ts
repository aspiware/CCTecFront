import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'summary-tab-placeholder',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  template: `
    <GridLayout>
      <ActionBar title="Summary"></ActionBar>
      <Label text="Summary placeholder" horizontalAlignment="center" verticalAlignment="center"></Label>
    </GridLayout>
  `,
})
export class SummaryTabPlaceholderComponent {}
