import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

@Component({
  standalone: true,
  selector: 'settings-tab-placeholder',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  template: `
    <GridLayout>
      <ActionBar title="Settings"></ActionBar>
      <Label text="Settings placeholder" horizontalAlignment="center" verticalAlignment="center"></Label>
    </GridLayout>
  `,
})
export class SettingsTabPlaceholderComponent {}
