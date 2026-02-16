import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { ObservableArray } from '@nativescript/core';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { UserModel } from '../shared/models/user.model';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from './today.service';

@Component({
  standalone: true,
  selector: 'app-today',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss',
})
export class TodayComponent implements OnInit {
  public user: UserModel;
  public jobList: ObservableArray<any>;
  public weeklyTotal = 0;
  public mainMenuIconName = 'ellipsis.circle';
  public item: any;
  scansMenu: Item =
    {
      name: 'Scans',
      options: [
        { name: 'Ingress Scans', icon: 'waveform.path' },
        { name: 'PHT Scans', icon: 'chart.bar.xaxis' },
        { name: 'Bonding Validation', icon: 'tag' },
        { name: 'XM Photo', icon: 'photo.fill' },
        {
          name: 'End of Day', icon: 'circle.slash.fill', destructive: true, confirm: {
            title: 'Do you want to log off for the day?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        }
      ],
    };
  jobMenu: Item =
    {
      name: 'Job Menu',
      options: [
        { name: 'Go Enroute', icon: 'car.fill' },
        { name: 'Go On Job', icon: 'wrench.fill' },
        { name: 'Complete Job', icon: 'checkmark.circle.fill' },
        // { name: 'Set ETC', icon: 'clock.fill' },
        { name: 'Set Location', icon: 'mappin.and.ellipse' },
      ],
    };
  mainMenu: Item =
    {
      name: 'Main Menu',
      options: [
        { name: 'Available', icon: 'checkmark.circle.fill' },
        { name: 'Lunch', icon: 'fork.knife.circle.fill' },
        { name: 'Tech Log', icon: 'network' },
        { name: 'Meeting', icon: 'inset.filled.rectangle.and.person.filled' },
        { name: 'Logged On', icon: 'iphone.and.arrow.right.outward' },
        {
          name: 'End of Day', icon: 'circle.slash.fill', destructive: true, confirm: {
            title: 'Do you want to log off for the day?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };
  mainMenuR: Item =
    {
      name: 'Main Menu Right',
      options: [
        { name: 'Location', icon: 'mappin.and.ellipse' },
        { name: 'Gate Codes', icon: 'square.grid.3x3' },
        { name: 'Customer Consent', icon: 'signature' },
        { name: 'Report Bug', icon: 'bubble.left.and.exclamationmark.bubble.right' },
        {
          name: 'Log Out', icon: 'person.crop.circle.badge.xmark', destructive: true, confirm: {
            title: 'Are you sure you want to log out?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };
  public isSyncing = false;
  public hasLunch: boolean;
  public techStatus: boolean;
  public isTechStatusLoading = false;

  constructor(
    private usersService: UsersService,
    private todayService: TodayService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.jobList = new ObservableArray([]);
    this.user = this.usersService.getUser() || { userId: 15 };
    this.mainMenuIconName = this.mainMenu?.options?.[0]?.icon || 'ellipsis.circle';
    this.onSummaryDirectRefresh();
    this.loadHeaderStatus();
  }

  public onSummaryDirectRefresh(): void {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    this.cdr.detectChanges();

    const userId = this.user?.userId || 0;
    let pending = 2;
    const onDone = () => {
      pending -= 1;
      if (pending <= 0) {
        this.isSyncing = false;
      }
      this.cdr.detectChanges();
    };

    this.todayService.findTodayByUser(userId).subscribe({
      next: (res) => {
        const jobs = Array.isArray(res?.jobs) ? res.jobs : (Array.isArray(res) ? res : []);
        this.jobList = new ObservableArray(jobs);
        onDone();
      },
      error: () => onDone(),
    });

    this.todayService.getTotalCurrentWeek(userId).subscribe({
      next: (res) => {
        this.weeklyTotal = Number(res?.total || res || 0);
        onDone();
      },
      error: () => onDone(),
    });
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    console.log('[Today] mainMenuR selected', event?.index);
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    const selected = this.mainMenu?.options?.[event?.index || 0];
    if (selected?.icon) {
      this.mainMenuIconName = selected.icon;
    }
    console.log('[Today] mainMenu selected', event?.index, selected?.name);
  }

  public selected(event: MenuEvent, item?: any): void {
    console.log('[Today] selected', event?.index, item);
  }

  private loadHeaderStatus(): void {
    const userId = this.user?.userId || 0;
    this.todayService.hasLunch(userId).subscribe({
      next: (res) => {
        this.hasLunch = !!(res?.hasLunch ?? res);
        this.cdr.detectChanges();
      },
      error: () => {
        this.hasLunch = false;
        this.cdr.detectChanges();
      },
    });
  }
}
