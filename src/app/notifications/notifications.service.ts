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

  public findActiveByUser(userId: number): Observable<any[]> {
    if (this.usersService.isDemoUser(this.usersService.getUser())) {
      return of([]);
    }

    return this.httpClient.get<any[]>(
      `${this.configService.getUrlBase()}/notifications/findActive/${userId}`
    );
  }

  public markDismissed(notificationId: number, userId: number): Observable<any> {
    if (this.usersService.isDemoUser(this.usersService.getUser())) {
      return of({ success: true });
    }

    return this.httpClient.post<any>(
      `${this.configService.getUrlBase()}/notifications/markDismissed/${notificationId}/${userId}`,
      null
    );
  }

  public markSeen(notificationId: number, userId: number): Observable<any> {
    if (this.usersService.isDemoUser(this.usersService.getUser())) {
      return of({ success: true });
    }

    return this.httpClient.post<any>(
      `${this.configService.getUrlBase()}/notifications/markSeen/${notificationId}/${userId}`,
      null
    );
  }
}
