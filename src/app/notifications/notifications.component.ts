import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Item } from '../shared/components/menu-button/item';
import { MenuEvent } from '../shared/components/menu-button';
import { NotificationsService } from './notifications.service';

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
  public currentIndex = 0;
  private userId = 0;
  private seenNotificationIds = new Set<number>();
  public mainMenu: Item = {
    name: 'Main Menu',
    options: [
      { name: 'Close', icon: 'xmark.circle' },
      { name: "Don't show again", icon: 'eye.slash' },
    ],
  };

  constructor(
    private modalParams: ModalDialogParams,
    private notificationsService: NotificationsService
  ) {
    const context = this.modalParams.context || {};
    const list = Array.isArray(context?.notifications)
      ? context.notifications
      : context?.notification
        ? [context.notification]
        : [];

    this.userId = Number(context?.userId || 0);
    this.notifications = list;
    this.notification = list[this.currentIndex] || null;
    this.markCurrentNotificationSeen();
  }

  get notificationTitle(): string {
    return String(this.notification?.title || this.notification?.name || 'Notification');
  }

  get notificationMessage(): string {
    return String(this.notification?.message || this.notification?.description || 'No details available.');
  }

  get notificationCountLabel(): string {
    return `${this.currentIndex + 1} of ${Math.max(this.notifications.length, 1)}`;
  }

  get shouldScrollMessage(): boolean {
    const message = this.notificationMessage;
    return message.length > 220 || message.includes('\n');
  }

  get hasMultipleNotifications(): boolean {
    return this.notifications.length > 1;
  }

  get canGoPrevious(): boolean {
    return this.currentIndex > 0;
  }

  get isLastNotification(): boolean {
    return this.currentIndex >= this.notifications.length - 1;
  }

  get primaryButtonText(): string {
    return this.isLastNotification ? 'Done' : 'Next';
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

  public showPrevious(): void {
    if (!this.canGoPrevious) {
      return;
    }

    this.currentIndex -= 1;
    this.notification = this.notifications[this.currentIndex] || null;
    this.markCurrentNotificationSeen();
  }

  public advance(): void {
    if (this.isLastNotification) {
      this.closeModal();
      return;
    }

    this.currentIndex += 1;
    this.notification = this.notifications[this.currentIndex] || null;
    this.markCurrentNotificationSeen();
  }

  private markCurrentNotificationSeen(): void {
    const notificationId = Number(this.notification?.id || 0);
    if (!this.userId || !notificationId || this.seenNotificationIds.has(notificationId)) {
      return;
    }

    this.seenNotificationIds.add(notificationId);
    this.notificationsService.markSeen(notificationId, this.userId).subscribe({
      error: (error) => {
        console.log('[Notifications] markSeen error', error);
        this.seenNotificationIds.delete(notificationId);
      },
    });
  }
}
