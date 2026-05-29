/**
 * OnboardingTooltip unit tests — DOM structure, positioning, dismissal.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OnboardingTooltip, type TooltipConfig } from '../../src/ui/components/OnboardingTooltip';

describe('OnboardingTooltip', () => {
  beforeEach(() => {
    // Set up a target element in the DOM
    const target = document.createElement('button');
    target.id = 'click-egg';
    target.textContent = 'Lay Egg';
    target.style.position = 'absolute';
    target.style.top = '100px';
    target.style.left = '200px';
    target.style.width = '120px';
    target.style.height = '40px';
    document.body.appendChild(target);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const baseConfig: TooltipConfig = {
    id: 'click_egg',
    targetSelector: '#click-egg',
    text: 'Click to lay an egg!',
    position: 'below',
  };

  describe('DOM structure', () => {
    it('creates an overlay element with correct class', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      tooltip.mount();

      const overlay = document.querySelector('.onboarding-overlay');
      expect(overlay).not.toBeNull();
    });

    it('creates a tooltip element inside the overlay', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      tooltip.mount();

      const tip = document.querySelector('.onboarding-tooltip');
      expect(tip).not.toBeNull();
      expect(tip?.parentElement?.className).toBe('onboarding-overlay');
    });

    it('displays the tooltip text', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      tooltip.mount();

      const text = document.querySelector('.onboarding-tooltip-text');
      expect(text?.textContent).toBe('Click to lay an egg!');
    });

    it('has a dismiss button', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      tooltip.mount();

      const btn = document.querySelector('.onboarding-tooltip-dismiss');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toBe('Got it!');
    });
  });

  describe('dismissal', () => {
    it('removes the overlay from DOM on dismiss', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      tooltip.mount();

      expect(document.querySelector('.onboarding-overlay')).not.toBeNull();

      tooltip.dismiss();

      expect(document.querySelector('.onboarding-overlay')).toBeNull();
    });

    it('removes the overlay when dismiss button is clicked', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      tooltip.mount();

      const btn = document.querySelector('.onboarding-tooltip-dismiss') as HTMLElement;
      btn.click();

      expect(document.querySelector('.onboarding-overlay')).toBeNull();
    });

    it('calls onDismiss callback when dismissed', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      let dismissed = false;
      tooltip.onDismiss(() => { dismissed = true; });
      tooltip.mount();

      tooltip.dismiss();

      expect(dismissed).toBe(true);
    });

    it('calls onDismiss callback when button is clicked', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      let dismissed = false;
      tooltip.onDismiss(() => { dismissed = true; });
      tooltip.mount();

      const btn = document.querySelector('.onboarding-tooltip-dismiss') as HTMLElement;
      btn.click();

      expect(dismissed).toBe(true);
    });
  });

  describe('positioning', () => {
    it('adds position class to tooltip', () => {
      const tooltip = new OnboardingTooltip({ ...baseConfig, position: 'below' });
      tooltip.mount();

      const tip = document.querySelector('.onboarding-tooltip');
      expect(tip?.classList.contains('onboarding-tooltip--below')).toBe(true);
    });

    it('defaults to center when target not found', () => {
      const config: TooltipConfig = {
        id: 'missing',
        targetSelector: '#nonexistent',
        text: 'Test',
      };
      const tooltip = new OnboardingTooltip(config);
      tooltip.mount();

      const tip = document.querySelector('.onboarding-tooltip');
      expect(tip?.classList.contains('onboarding-tooltip--center')).toBe(true);
    });
  });

  describe('getElement', () => {
    it('returns the overlay element', () => {
      const tooltip = new OnboardingTooltip(baseConfig);
      const el = tooltip.getElement();
      expect(el.className).toBe('onboarding-overlay');
    });
  });
});
