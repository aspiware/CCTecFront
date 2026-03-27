import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { SwipeDirection, SwipeGestureEventData } from '@nativescript/core';
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
      description: 'Track your jobs, equipment, and earnings in one place.',
      eyebrow: 'Built for cable technicians',
      art: 'welcome',
    },
    {
      title: 'Set Your Prices First',
      description: 'Before using the app, go to Settings and add your job prices and equipment prices.',
      art: 'prices',
    },
    {
      title: 'Track Your Earnings',
      description: 'Automatically calculate your daily and weekly income.',
      art: 'calculations',
    },
    {
      title: 'Manage Your Jobs',
      description: 'View your job history and keep everything organized.',
      art: 'tracking',
    },
    {
      title: 'You’re Ready to Start',
      description: 'Complete your setup in Settings and start tracking your work.',
      art: 'ready',
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
    return this.isLastSlide ? 'Go to Settings' : 'Next';
  }

  get showSecondaryButton(): boolean {
    return this.isLastSlide;
  }

  public skip(): void {
    this.completeOnboarding(false);
  }

  public advance(): void {
    if (this.isLastSlide) {
      this.completeOnboarding(true);
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

  public onSwipe(args: SwipeGestureEventData): void {
    if (args.direction === SwipeDirection.left && !this.isLastSlide) {
      this.currentIndex += 1;
      return;
    }

    if (args.direction === SwipeDirection.right && this.currentIndex > 0) {
      this.currentIndex -= 1;
    }
  }

  private completeOnboarding(openSettings: boolean): void {
    setBoolean(OnboardingComponent.STORAGE_KEY, true);
    this.modalParams.closeCallback({ completed: true, openSettings });
  }
}
