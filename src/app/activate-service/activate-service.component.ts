import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { getNumber } from '@nativescript/core/application-settings';
import { TodayService } from '../today/today.service';

@Component({
  standalone: true,
  selector: 'app-activate-service',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './activate-service.component.html',
  styleUrl: './activate-service.component.scss',
})
export class ActivateServiceComponent {
  public url = 'https://www.xfinity.com/activate';
  private userId = 0;

  constructor(
    private route: ActivatedRoute,
    private todayService: TodayService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const accountNumber = String(params?.accountNumber || '').trim();
      const workOrderNumber = String(params?.workOrderNumber || '').trim();
      this.userId = getNumber('userId', 0);

      if (!this.userId || !accountNumber || !workOrderNumber) {
        return;
      }

      this.todayService.getActivationLink(this.userId, accountNumber, workOrderNumber).subscribe({
        next: (resp) => {
          console.log('GETACTIVATIONLINK', resp);
          const link = String(resp?.caapActivationLink || '').trim();
          if (!link) {
            return;
          }

          this.url = link;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.log('[ActivateService] getActivationLink error', error);
        },
      });
    });
  }
}
