import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'today-tab-placeholder',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  template: `
    <GridLayout>
      <ActionBar title="Today"></ActionBar>
      <Label text="Today placeholder" horizontalAlignment="center" verticalAlignment="center"></Label>
    </GridLayout>
  `,
})
export class TodayTabPlaceholderComponent {}
