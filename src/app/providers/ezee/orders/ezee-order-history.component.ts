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
    const date = this.parseDate(String(raw));
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
    const author = item?.author ?? item?.createdBy ?? item?.user;
    if (author && typeof author === 'object') {
      const name = String(author.name || author.fullName || author.username || '').trim();
      const techCode = String(author.techCode || '').trim();
      return name && techCode ? `${name} (${techCode})` : name || techCode;
    }
    return author ? String(author).trim() : '';
  }

  public getHistoryComment(item: any): string {
    let comment = String(
      item?.comment ?? item?.note ?? item?.text ?? item?.description ?? item?.value ?? ''
    );
    comment = this.decodeFormEncodedComment(comment);
    comment = this.decodeHtmlEntities(comment);

    const formattedComment = comment
      .replace(/\\r\\n|\\n|\\r/g, '\n')
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li(?:\s[^>]*)?>/gi, '• ')
      .replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi, '\n')
      .replace(/<(?:p|div|tr|h[1-6])(?:\s[^>]*)?>/gi, '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return this.restoreStructuredNoteLineBreaks(formattedComment);
  }

  private restoreStructuredNoteLineBreaks(value: string): string {
    return value.replace(
      /\s+(?=(?:Address|Pre-Installation Walkthrough,\s*Performed With|Equipment Location|Fiber Installation Process|Assisted Customer with Router Setup|Eero Speeds|Terminal Splice|NID Splice|NID Light Levels|ONT Light Levels|ONT Serial Number|Eero Serial Number|Tech notes|Tech Name\/ID|Tech|Date):)/gi,
      '\n'
    );
  }

  private decodeFormEncodedComment(value: string): string {
    if (!/%[0-9A-F]{2}/i.test(value)) {
      return value;
    }
    try {
      return decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      return value;
    }
  }

  private decodeHtmlEntities(value: string): string {
    const namedEntities: Record<string, string> = {
      amp: '&',
      apos: "'",
      gt: '>',
      lt: '<',
      nbsp: ' ',
      quot: '"',
    };
    let decoded = value;
    for (let pass = 0; pass < 2; pass += 1) {
      decoded = decoded.replace(
        /&(#x[0-9A-F]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
        (entity, code: string) => {
          if (code.startsWith('#x') || code.startsWith('#X')) {
            const value = Number.parseInt(code.slice(2), 16);
            return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
          }
          if (code.startsWith('#')) {
            const value = Number.parseInt(code.slice(1), 10);
            return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
          }
          return namedEntities[code.toLowerCase()] ?? entity;
        }
      );
    }
    return decoded;
  }

  private loadOrderNotes(): void {
    const rawNotes = this.job?.notes ?? (this.job as any)?.note ?? (this.job as any)?.orderNotes;
    const notes = this.extractNotes(rawNotes).map((note) => {
      if (note && typeof note === 'object') {
        return note;
      }
      return {
        subject: 'Order Note',
        comment: String(note ?? ''),
        date: this.job?.date,
      };
    }).filter((note) => this.getHistoryComment(note));

    this.jobHistoryList = new ObservableArray(notes);
  }

  private extractNotes(rawNotes: unknown): any[] {
    if (Array.isArray(rawNotes)) {
      return rawNotes;
    }
    if (rawNotes && typeof rawNotes === 'object') {
      const nested = (rawNotes as any).data || (rawNotes as any).notes || (rawNotes as any).history;
      return Array.isArray(nested) ? nested : [rawNotes];
    }
    return rawNotes === null || rawNotes === undefined || rawNotes === '' ? [] : [rawNotes];
  }

  private parseDate(value: string): Date {
    const match = value.trim().match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i
    );
    if (!match) {
      return new Date(value);
    }

    const [, month, day, year, rawHour, minute, second, meridiem] = match;
    let hour = Number(rawHour) % 12;
    if (meridiem.toUpperCase() === 'PM') {
      hour += 12;
    }
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      hour,
      Number(minute),
      Number(second)
    );
  }

  private syncTheme(): void {
    this.isDarkTheme = Application.systemAppearance() === 'dark';
  }
}
