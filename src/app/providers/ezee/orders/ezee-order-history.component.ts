import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Application, ObservableArray } from '@nativescript/core';
import { MenuEvent } from '../../../shared/components/menu-button';
import { Item } from '../../../shared/components/menu-button/item';
import { EzeeOrderListItem } from './ezee-order.model';

@Component({
  standalone: true,
  selector: 'app-ezee-order-history',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: '../../../job-history/job-history.component.html',
  styleUrl: '../../../job-history/job-history.component.scss',
})
export class EzeeOrderHistoryComponent implements OnInit, OnDestroy {
  public modalTitle = 'Order Notes';
  public emptyHistoryMessage = 'No notes found for this order.';
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public job: EzeeOrderListItem;
  public jobHistoryList = new ObservableArray<any>([]);
  public isRefreshingMainMenu = false;
  public isLoading = false;
  public loadError = '';
  private appearanceChangedHandler?: () => void;

  public mainMenu: Item = {
    name: 'Main Menu',
    options: [{ name: 'Refresh', icon: 'arrow.clockwise' }],
  };

  public constructor(
    private modalParams: ModalDialogParams,
    private cdr: ChangeDetectorRef
  ) {
    this.job = this.modalParams.context || ({} as EzeeOrderListItem);
  }

  public ngOnInit(): void {
    this.syncTheme();
    this.loadOrderNotes();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
  }

  public ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public get mainMenuOptions(): Item['options'] {
    return this.mainMenu.options;
  }

  public closeWithoutSave(): void {
    this.modalParams.closeCallback({ job: this.job });
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    if (event?.index !== 0) {
      return;
    }
    this.isRefreshingMainMenu = true;
    this.loadOrderNotes();
    this.isRefreshingMainMenu = false;
    this.cdr.detectChanges();
  }

  public getHistoryTitle(item: any): string {
    return String(item?.subject || item?.title || item?.type || 'Order Note');
  }

  public getHistoryDate(item: any): string {
    const raw = item?.dateWritten || item?.createdAt || item?.updatedAt || item?.date || this.job?.date;
    if (!raw) {
      return 'No date';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return String(raw);
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  public getHistoryAuthor(item: any): string {
    const author = item?.author ?? item?.createdBy ?? item?.user ?? item?.person ?? item?.technician ?? item?.writtenBy;
    if (author && typeof author === 'object') {
      return String(author?.fullName || author?.name || author?.username || '').trim();
    }
    if (author) {
      return String(author).trim();
    }
    const entryType = String(item?.type || item?.field || item?.label || '').toLowerCase();
    return /author|person|technician|created by|written by/.test(entryType)
      ? String(item?.value || '').trim()
      : '';
  }

  public getHistoryComment(item: any): string {
    const explicitComment = item?.comment ?? item?.note ?? item?.text ?? item?.message ?? item?.content ?? item?.description;
    const entryType = String(item?.type || item?.field || item?.label || '').toLowerCase();
    const comment = String(
      explicitComment ?? (/note|comment|description/.test(entryType) ? item?.value : '') ?? ''
    );
    return comment
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .trim();
  }

  private loadOrderNotes(): void {
    const rawNotes = this.job?.notes ?? (this.job as any)?.note ?? (this.job as any)?.orderNotes;
    const notes: any[] = [];
    let pendingAuthor = '';

    this.extractNotes(rawNotes).forEach((entry, index, entries) => {
      if (entry && typeof entry === 'object') {
        const author = this.getHistoryAuthor(entry);
        const comment = this.getHistoryComment(entry);
        if (!comment && author) {
          pendingAuthor = author;
          return;
        }
        if (!comment) {
          return;
        }
        notes.push({
          ...entry,
          author: author || pendingAuthor,
          comment,
        });
        pendingAuthor = '';
        return;
      }

      const text = String(entry ?? '').trim();
      if (!text) {
        return;
      }
      if (index < entries.length - 1 && this.looksLikeAuthorName(text)) {
        pendingAuthor = text;
        return;
      }
      notes.push({
        subject: 'Order Note',
        author: pendingAuthor,
        comment: text,
        date: this.job?.date,
      });
      pendingAuthor = '';
    });

    this.jobHistoryList = new ObservableArray(notes);
  }

  private extractNotes(rawNotes: unknown): any[] {
    if (Array.isArray(rawNotes)) {
      return rawNotes;
    }
    if (rawNotes && typeof rawNotes === 'object') {
      const nested =
        (rawNotes as any).data ||
        (rawNotes as any).notes ||
        (rawNotes as any).history ||
        (rawNotes as any).entries ||
        (rawNotes as any).items ||
        (rawNotes as any).list;
      return Array.isArray(nested) ? nested : [rawNotes];
    }
    return rawNotes === null || rawNotes === undefined || rawNotes === '' ? [] : [rawNotes];
  }

  private looksLikeAuthorName(value: string): boolean {
    const words = value.trim().split(/\s+/);
    if (words.length < 2 || words.length > 5 || value.length > 80) {
      return false;
    }
    return words.every((word) => /^[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ.'-]*$/.test(word));
  }

  private syncTheme(): void {
    this.isDarkTheme = Application.systemAppearance() === 'dark';
  }
}
