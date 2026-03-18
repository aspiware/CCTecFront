import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';

export type CreateExpenseDto = {
  userId: number;
  expenseTypeId: number;
  amount: number;
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
}
