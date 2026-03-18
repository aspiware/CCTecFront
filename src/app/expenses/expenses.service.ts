import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { request } from '@nativescript/core/http';
import { File as NSFile, getFileAccess } from '@nativescript/core/file-system';
import { File as MultipartFile, FormData } from '@nativescript/core/xhr';
import { Observable, from, map, of } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';

export type CreateExpenseDto = {
  userId: number;
  expenseTypeId: number;
  amount: number;
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

    const formData = new FormData();
    for (const file of files) {
      if (!file?.path || !NSFile.exists(file.path)) {
        continue;
      }

      const buffer = getFileAccess().readBufferSync(file.path);
      const multipartFile = new MultipartFile(
        [buffer],
        String(file.name || 'attachment'),
        {
          type: String(file.mimeType || 'application/octet-stream'),
          lastModified: Date.now(),
        }
      );

      formData.append('files', multipartFile);
    }

    return from(request({
      url: `${this.configService.getUrlBase()}/expenses/${expenseId}/files`,
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      content: formData as any,
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
}
