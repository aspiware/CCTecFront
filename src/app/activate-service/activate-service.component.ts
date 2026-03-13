import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit, ViewContainerRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalDialogService, NativeScriptCommonModule } from '@nativescript/angular';
import { getNumber } from '@nativescript/core/application-settings';
import { CustomerInfoComponent } from '../customer-info/customer-info.component';
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
  private currentJob: any = null;

  constructor(
    private route: ActivatedRoute,
    private todayService: TodayService,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.currentJob = this.normalizeJobParams(params || {});
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

  public showCustomerInfo(): void {
    if (!this.currentJob) {
      return;
    }

    const options: any = {
      context: this.currentJob,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
      },
    };

    this.modalService.showModal(CustomerInfoComponent, options);
  }

  private normalizeJobParams(params: any): any {
    return {
      ...params,
      customer: this.parseJsonParam(params?.customer),
      devices: this.parseJsonParam(params?.devices),
      customJob: this.parseJsonParam(params?.customJob),
    };
  }

  private parseJsonParam(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    const text = value.trim();
    if (!text || text === '[object Object]') {
      return null;
    }

    const looksLikeJson =
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'));
    if (!looksLikeJson) {
      return value;
    }

    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  }
}
