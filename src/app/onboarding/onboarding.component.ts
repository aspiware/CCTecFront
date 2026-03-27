import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { setBoolean } from '@nativescript/core/application-settings';

@Component({
  standalone: true,
  selector: 'app-onboarding',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  private static readonly STORAGE_KEY = 'hasSeenOnboarding';

  public currentIndex = 0;
  public slides = [
    {
      title: 'Welcome to CCTec',
      description: 'Track jobs, manage expenses, and keep your day organized from one place.',
      accent: 'Today',
    },
    {
      title: 'Manage Expenses Faster',
      description: 'Add expenses with category, date, notes, and attachments so everything stays documented.',
      accent: 'Expenses',
    },
    {
      title: 'Stay Up to Date',
      description: 'Check notifications, settings, and updates in-app so you do not miss important changes.',
      accent: 'Settings',
    },
  ];

  constructor(private modalParams: ModalDialogParams) {}

  get slide(): any {
    return this.slides[this.currentIndex] || this.slides[0];
  }

  get isLastSlide(): boolean {
    return this.currentIndex >= this.slides.length - 1;
  }

  get primaryButtonText(): string {
    return this.isLastSlide ? 'Get Started' : 'Next';
  }

  public skip(): void {
    this.completeOnboarding();
  }

  public advance(): void {
    if (this.isLastSlide) {
      this.completeOnboarding();
      return;
    }

    this.currentIndex += 1;
  }

  public goToSlide(index: number): void {
    if (index < 0 || index >= this.slides.length) {
      return;
    }

    this.currentIndex = index;
  }

  private completeOnboarding(): void {
    setBoolean(OnboardingComponent.STORAGE_KEY, true);
    this.modalParams.closeCallback(true);
  }
}
