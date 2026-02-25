import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';

@Component({
  standalone: true,
  selector: 'app-edit-job',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './edit-job.component.html',
  styleUrl: './edit-job.component.scss',
})
export class EditJobComponent {
  public job: any;
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [{ name: 'Options', icon: 'ellipsis.circle' }],
  };

  constructor(private modalParams: ModalDialogParams) {
    this.job = this.modalParams.context;
  }

  public onSelectedMainMenu(_event: MenuEvent): void {
    // Placeholder: menu actions will be added later.
  }

  public closeModal(): void {
    this.modalParams.closeCallback();
  }
}

