import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TodayJobsCountService {
  private readonly countSubject = new BehaviorSubject<number>(0);
  public readonly count$ = this.countSubject.asObservable();

  public setCount(count: number): void {
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    this.countSubject.next(safeCount);
  }
}
