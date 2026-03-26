import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { request } from '@nativescript/core/http';
import { File as NSFile, getFileAccess } from '@nativescript/core/file-system';
import { Observable, from, map, of } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';

export type CreateExpenseDto = {
  userId: number;
  expenseTypeId: number;
  amount: number;
  notes?: string;
  expenseDate?: string;
};

export type UpdateExpenseDto = {
  expenseTypeId: number;
  amount: number;
  notes?: string;
  expenseDate?: string;
};

export type ExpenseUploadFile = {
  name: string;
  path: string;
  mimeType?: string;
  size?: number;
};

@Injectable({
  providedIn: 'root',
})
export class ExpensesService {
  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService,
    private usersService: UsersService
  ) {}

  public findByUserAndDates(
    userId: number,
    startDate: string,
    endDate: string
  ): Observable<any> {
    if (this.usersService.isDemoUser()) {
      return of([]);
    }

    return this.httpClient.get<any>(
      encodeURI(
        `${this.configService.getUrlBase()}/expenses/findByUserAndDates/${userId}/${startDate}/${endDate}`
      )
    );
  }

  public findExpenseTypes(): Observable<any> {
    if (this.usersService.isDemoUser()) {
      return of([]);
    }

    return this.httpClient.get<any>(
      `${this.configService.getUrlBase()}/expenses/findExpenseTypes`
    );
  }

  public findExpenseCategories(): Observable<any> {
    if (this.usersService.isDemoUser()) {
      return of([]);
    }

    return this.httpClient.get<any>(
      `${this.configService.getUrlBase()}/expenses/findExpenseCategories`
    );
  }

  public create(expense: CreateExpenseDto): Observable<any> {
    if (this.usersService.isDemoUser()) {
      return of({
        id: Date.now(),
        ...expense,
        createdAt: new Date().toISOString(),
      });
    }

    return this.httpClient.post<any>(
      `${this.configService.getUrlBase()}/expenses/create`,
      expense
    );
  }

  public update(id: number, expense: UpdateExpenseDto): Observable<any> {
    if (!id) {
      return of(null);
    }

    if (this.usersService.isDemoUser()) {
      return of({
        id,
        ...expense,
        updatedAt: new Date().toISOString(),
      });
    }

    return this.httpClient.put<any>(
      `${this.configService.getUrlBase()}/expenses/${id}`,
      expense
    );
  }

  public delete(id: number): Observable<any> {
    if (!id) {
      return of(null);
    }

    if (this.usersService.isDemoUser()) {
      return of({ id, deleted: true });
    }

    return this.httpClient.delete<any>(
      `${this.configService.getUrlBase()}/expenses/${id}`
    );
  }

  public uploadFiles(expenseId: number, files: ExpenseUploadFile[]): Observable<any> {
    if (!expenseId || !files?.length) {
      return of(null);
    }

    if (this.usersService.isDemoUser()) {
      return of({
        expenseId,
        filesUploaded: files.length,
      });
    }

    const boundary = `----CCTecExpenseBoundary${Date.now()}`;
    const encoder = new TextEncoder();
    const bodyChunks: Uint8Array[] = [];
    let appendedFiles = 0;

    for (const file of files) {
      if (!file?.path || !NSFile.exists(file.path)) {
        continue;
      }

      const fileName = String(file.name || 'attachment');
      const mimeType = String(file.mimeType || 'application/octet-stream');
      const fileBuffer = new Uint8Array(getFileAccess().readBufferSync(file.path));

      bodyChunks.push(
        encoder.encode(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="files"; filename="${this.escapeHeaderValue(fileName)}"\r\n` +
          `Content-Type: ${mimeType}\r\n\r\n`
        )
      );
      bodyChunks.push(fileBuffer);
      bodyChunks.push(encoder.encode('\r\n'));
      appendedFiles += 1;
    }

    if (!appendedFiles) {
      return of(null);
    }

    bodyChunks.push(encoder.encode(`--${boundary}--\r\n`));
    const multipartBody = this.concatChunks(bodyChunks);

    return from(request({
      url: `${this.configService.getUrlBase()}/expenses/${expenseId}/files`,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      content: multipartBody.buffer.slice(
        multipartBody.byteOffset,
        multipartBody.byteOffset + multipartBody.byteLength
      ) as ArrayBuffer,
    })).pipe(
      map((response) => {
        const rawBody = response.content?.toString?.() || '';
        const payload = this.parseResponseBody(rawBody);

        if (response.statusCode >= 400) {
          throw payload || {
            message: `Upload failed with status ${response.statusCode}.`,
          };
        }

        return payload;
      })
    );
  }

  private parseResponseBody(rawBody: string): any {
    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }

  private concatChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return merged;
  }

  private escapeHeaderValue(value: string): string {
    return String(value || '').replace(/"/g, '\\"');
  }
}
