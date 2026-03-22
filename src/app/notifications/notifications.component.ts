import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';

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

  public closeModal(): void {
    this.modalParams.closeCallback();
  }
}
