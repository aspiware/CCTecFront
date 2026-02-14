import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'jobs-tab-placeholder',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  template: `
    <GridLayout>
      <ActionBar title="Jobs"></ActionBar>
      <Label text="Jobs placeholder" horizontalAlignment="center" verticalAlignment="center"></Label>
    </GridLayout>
  `,
})
export class JobsTabPlaceholderComponent {}
