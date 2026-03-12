import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Page, alert, isIOS } from '@nativescript/core';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../shared/services/users.service';

@Component({
  standalone: true,
  selector: 'app-xm-update-token',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './xm-update-token.component.html',
  styleUrl: './xm-update-token.component.scss',
})
export class XmUpdateTokenComponent implements OnInit, OnDestroy {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public token = '';
  public settings: any = null;
  private appearanceChangedHandler?: () => void;
  public mainMenuR: Item = {
    name: 'Main Menu Right',
    options: [{
      name: 'Save',
      icon: 'checkmark.circle',
      destructive: true,
      confirm: {
        title: 'Are you sure you want to save changes?',
        confirmText: 'Yes',
        cancelText: 'Cancel',
        presentation: 'anchor',
      },
    }],
  };

  constructor(
    private usersService: UsersService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    private page: Page
  ) {}

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    this.loadXmToken();
  }

  ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    if (event?.index !== 0 || this.isSaveLoading) {
      return;
    }
    this.saveXmToken();
  }

  private loadXmToken(): void {
    const userId = Number(this.usersService.getUser()?.userId || 0);
    if (!userId) {
      this.token = '';
      this.cdr.detectChanges();
      return;
    }

    this.settingsService.findByUser(userId).subscribe({
      next: (res: any) => {
        this.settings = res || null;
        this.token = String(res?.xmToken || '');
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[XmUpdateToken] findByUser error', error);
      },
    });
  }

  private syncTheme(): void {
    const appAppearance = Application.systemAppearance();
    if (appAppearance === 'dark' || appAppearance === 'light') {
      this.isDarkTheme = appAppearance === 'dark';
      return;
    }

    const pageClassName = String(this.page.className || '');
    this.isDarkTheme = pageClassName.includes('ns-dark');
  }

  private saveXmToken(): void {
    if (!this.settings?.id) {
      alert({
        title: 'Error',
        message: 'Settings not loaded yet.',
        okButtonText: 'OK',
      });
      return;
    }

    const settingsPayload = {
      ...this.settings,
      xmToken: String(this.token || '').trim(),
    };

    this.isSaveLoading = true;
    this.cdr.detectChanges();

    this.settingsService.update(this.settings.id, settingsPayload).subscribe({
      next: () => {
        this.settings = settingsPayload;
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.showSavedPopupAnchored();
        }, 0);
      },
      error: (error) => {
        console.log('[XmUpdateToken] update error', error);
        this.isSaveLoading = false;
        this.cdr.detectChanges();
        alert({
          title: 'Error',
          message: 'Unable to save token.',
          okButtonText: 'OK',
        });
      },
    });
  }

  private async showSavedPopupAnchored(): Promise<void> {
    if (!isIOS) {
      await alert({
        title: 'Saved',
        message: 'Token updated successfully.',
        okButtonText: 'OK',
      });
      return;
    }

    try {
      const anchorView = this.page.getViewById('xm-update-token-menu-btn') as any;
      const iosAnchor = anchorView?.ios as UIButton | undefined;
      const popup = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
        'Saved',
        'Token updated successfully.',
        UIAlertControllerStyle.ActionSheet
      );
      popup.addAction(
        UIAlertAction.actionWithTitleStyleHandler('OK', UIAlertActionStyle.Default, null)
      );

      let viewController = Application.ios?.rootController;
      while (
        viewController &&
        viewController.presentedViewController &&
        !viewController.presentedViewController.beingDismissed
      ) {
        viewController = viewController.presentedViewController;
      }

      if (!viewController) {
        await alert({
          title: 'Saved',
          message: 'Token updated successfully.',
          okButtonText: 'OK',
        });
        return;
      }

      const popover = popup.popoverPresentationController;
      if (popover) {
        if (iosAnchor) {
          popover.sourceView = iosAnchor;
          popover.sourceRect = iosAnchor.bounds;
        } else {
          popover.sourceView = viewController.view;
          popover.sourceRect = CGRectMake(
            viewController.view.bounds.size.width / 2.0,
            viewController.view.bounds.size.height / 2.0,
            1.0,
            1.0
          );
        }
        popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
      }

      viewController.presentViewControllerAnimatedCompletion(popup, true, null);
    } catch (error) {
      console.log('[XmUpdateToken] showSavedPopupAnchored error', error);
      await alert({
        title: 'Saved',
        message: 'Token updated successfully.',
        okButtonText: 'OK',
      });
    }
  }
}
