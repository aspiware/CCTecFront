import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';

@Component({
  standalone: true,
  selector: 'app-notifications',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {
  public notifications: any[] = [];
  public notification: any = null;
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      { name: 'Close', icon: 'xmark.circle' },
      { name: "Don't show again", icon: 'eye.slash' },
    ],
  };

  constructor(private modalParams: ModalDialogParams) {
    const context = this.modalParams.context || {};
    const list = Array.isArray(context?.notifications)
      ? context.notifications
      : context?.notification
        ? [context.notification]
        : [];

    this.notifications = list;
    this.notification = list[0] || null;
  }

  get notificationTitle(): string {
    return String(this.notification?.title || this.notification?.name || 'Notification');
  }

  get notificationMessage(): string {
    return String(this.notification?.message || this.notification?.description || 'No details available.');
  }

  get notificationCountLabel(): string {
    return this.notifications.length > 1 ? `${this.notifications.length} active` : '1 active';
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    if (event?.index === 0) {
      this.closeModal();
      return;
    }

    if (event?.index === 1) {
      this.modalParams.closeCallback({
        dontShowAgain: true,
        notificationId: this.notification?.id || null,
      });
    }
  }

  public closeModal(): void {
    this.modalParams.closeCallback();
  }
}
