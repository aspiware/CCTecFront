import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(
    private httpClient: HttpClient,
    private configService: ConfigService,
    private usersService: UsersService
  ) {}

  public findActive(): Observable<any[]> {
    if (this.usersService.isDemoUser(this.usersService.getUser())) {
      return of([]);
    }

    return this.httpClient.get<any[]>(
      `${this.configService.getUrlBase()}/notifications/findActive`
    );
  }
}
