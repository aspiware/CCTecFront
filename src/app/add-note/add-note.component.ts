import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button/common';

@Component({
  standalone: true,
  selector: 'app-add-note',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './add-note.component.html',
  styleUrl: './add-note.component.scss',
})
export class AddNoteComponent {
  public noteText = '';
    public mainMenu: Item = {
      name: 'Main Menu',
      options: [
        {
          name: 'Save',
          icon: 'checkmark.circle',
          destructive: true,
          confirm: {
            title: 'Save note?',
            confirmText: 'Save',
            cancelText: 'Cancel',
            presentation: 'anchor',
          },
        }
      ],
    };
  
    get mainMenuOptions() {
      return this.mainMenu.options;
    }

  constructor(private modalParams: ModalDialogParams) {
    const context = this.modalParams.context || {};
    this.noteText = String(context?.note || '');
  }

  public onNoteChanged(value: string): void {
    this.noteText = String(value || '');
  }

  public closeWithoutSave(): void {
    this.modalParams.closeCallback();
  }

  public saveNote(): void {
    this.modalParams.closeCallback(this.noteText || '');
  }

    public onSelectedMainMenu(event: MenuEvent, _menuStatus?: any): void {
      switch (event?.index) {
        case 0:
          this.saveNote();
          break;
      }
    }
}
