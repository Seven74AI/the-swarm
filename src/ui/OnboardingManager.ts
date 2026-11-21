import { OnboardingTooltip, type TooltipConfig } from './OnboardingTooltip';
import type { IntroFlag } from '../platform/storage/introFlag';

/**
 * OnboardingManager — Controls the onboarding tooltip sequence.
 *
 * Completion is the intro flag main passes in (platform/, Story 2.2: its own
 * key, outside the save).
 * When the player hasn't completed onboarding, shows tooltips sequentially.
 * After all tooltips are dismissed, marks onboarding as complete.
 *
 * Steps (3 tooltips):
 *   1. "Click to lay an egg" — points at the Lay Egg button
 *   2. "Your eggs hatch into larvae" — points at the resource panel
 *   3. "Assign workers to harvest" — points at worker assignment
 */

export interface OnboardingDeps {
  /** Whether the intro was finished (platform/storage/introFlag). */
  readonly flag: IntroFlag;
  /** A save was found (any load status but `empty`): a returning player skips the intro. */
  readonly hasSave: boolean;
}

const TOOLTIP_STEPS: TooltipConfig[] = [
  {
    id: 'click_egg',
    targetSelector: '#click-egg',
    text: 'Tap to lay an egg.',
    position: 'below',
  },
  {
    id: 'eggs_hatch',
    targetSelector: '.resource-panel',
    text: 'Your eggs hatch into larvae.',
    position: 'right',
  },
  {
    id: 'assign_workers',
    targetSelector: '#worker-assignment',
    text: 'Assign workers to harvest food.',
    position: 'right',
  },
];

export class OnboardingManager {
  private currentStep = 0;
  private activeTooltip: OnboardingTooltip | null = null;

  constructor(private readonly deps: OnboardingDeps) {}

  /**
   * Check whether onboarding has already been completed.
   */
  isCompleted(): boolean {
    return this.deps.flag.done();
  }

  /**
   * Start the onboarding sequence. Shows the first tooltip.
   * Does nothing if onboarding is already completed or all steps done.
   */
  start(): void {
    if (this.isCompleted()) return;
    // If the player already has a save, they're a returning player — skip onboarding.
    // This also prevents the onboarding overlay from blocking E2E tests that seed a save.
    if (this.deps.hasSave) return;
    if (this.currentStep >= TOOLTIP_STEPS.length) return;

    this.showCurrentStep();
  }

  /**
   * Show the current step's tooltip.
   */
  private showCurrentStep(): void {
    if (this.currentStep >= TOOLTIP_STEPS.length) {
      this.markComplete();
      return;
    }

    const config = TOOLTIP_STEPS[this.currentStep];

    // Check if target exists in the DOM
    const target = document.querySelector(config.targetSelector);
    if (!target) {
      // Target element not yet in DOM — skip this step and try the next
      this.currentStep++;
      this.showCurrentStep();
      return;
    }

    this.activeTooltip = new OnboardingTooltip(config);
    this.activeTooltip.onDismiss(() => {
      this.activeTooltip = null;
      this.currentStep++;
      // Brief delay before showing next step for a smoother transition
      setTimeout(() => this.showCurrentStep(), 300);
    });
    this.activeTooltip.mount();
  }

  /**
   * Mark onboarding as complete.
   */
  private markComplete(): void {
    this.deps.flag.markDone();
  }

  /**
   * Reset onboarding (for testing or debug).
   */
  reset(): void {
    this.deps.flag.reset();
  }
}
