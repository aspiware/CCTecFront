import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Page } from '@nativescript/core';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { UserModel } from '../shared/models/user.model';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from '../today/today.service';

@Component({
  standalone: true,
  selector: 'app-residential-job-prices',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './residential-job-prices.component.html',
  styleUrl: './residential-job-prices.component.scss',
})
export class ResidentialJobPricesComponent implements OnInit, OnDestroy {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isSaveLoading = false;
  public isLoading = false;
  public jobTypes: any[] = [];
  public user: UserModel | null = null;
  private appearanceChangedHandler?: () => void;
  public mainMenuR: Item = {
    name: 'Main Menu Right',
    options: [
      {
        name: 'Save',
        icon: 'checkmark.circle',
        destructive: true,
        confirm: {
          title: 'Are you sure you want to save changes?',
          confirmText: 'Yes',
          cancelText: 'Cancel',
          presentation: 'anchor',
        },
      },
      { name: 'Refresh', icon: 'arrow.clockwise' },
    ],
  };

  constructor(
    private usersService: UsersService,
    private todayService: TodayService,
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

    this.user = this.usersService.getUser() || null;
    this.loadJobTypes();
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
    switch (event?.index) {
      case 0:
        this.saveChanges();
        break;
      case 1:
        this.refreshData();
        break;
      default:
        break;
    }
  }

  private saveChanges(): void {
    if (this.isSaveLoading) {
      return;
    }

    this.isSaveLoading = true;

    // Placeholder save flow until backend wiring is added.
    setTimeout(() => {
      this.isSaveLoading = false;
    }, 1200);
  }

  private refreshData(): void {
    this.loadJobTypes();
  }

  private loadJobTypes(): void {
    const userId = Number(this.user?.userId || 0);
    if (!userId) {
      this.isLoading = false;
      this.jobTypes = [];
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.todayService.getJobPricesByUser(userId, 'Residential', true).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        this.jobTypes = list.map((item: any) => ({
          id: Number(item?.jobTypeId || item?.id || 0),
          name: item?.name || item?.description || '-',
          price: Number(item?.price || 0),
          editablePrice: this.formatPriceInput(item?.price),
        }));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('[ResidentialJobPrices] getJobPricesByUser error', error);
        this.jobTypes = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  public onPriceChange(item: any, value: string): void {
    if (!item) {
      return;
    }
    item.editablePrice = value;
    const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    item.price = Number.isFinite(parsed) ? parsed : 0;
  }

  public onPriceBlur(item: any): void {
    if (!item) {
      return;
    }
    item.editablePrice = this.formatPriceInput(item.price);
  }

  private formatPriceInput(value: any): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '$0.00';
    }
    return `$${numeric.toFixed(2)}`;
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
}
