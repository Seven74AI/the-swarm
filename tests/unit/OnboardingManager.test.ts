/**
 * OnboardingManager unit tests — sequence progression, the intro flag (platform/, Story 2.2).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OnboardingManager } from '../../src/ui/OnboardingManager';
import { createIntroFlag } from '../../src/platform/storage/introFlag';

const flag = () => createIntroFlag(localStorage);
const manager = (hasSave = false) => new OnboardingManager({ flag: flag(), hasSave });

describe('OnboardingManager', () => {
  beforeEach(() => {
    // Ensure clean localStorage state
    localStorage.clear();

    // Set up DOM elements that the tooltip targets
    const clickBtn = document.createElement('button');
    clickBtn.id = 'click-egg';
    clickBtn.style.cssText = 'position:absolute;top:100px;left:200px;width:120px;height:40px';
    document.body.appendChild(clickBtn);

    const resourcePanel = document.createElement('div');
    resourcePanel.className = 'resource-panel';
    resourcePanel.style.cssText = 'position:absolute;top:50px;left:400px;width:300px;height:60px';
    document.body.appendChild(resourcePanel);

    const workerPanel = document.createElement('div');
    workerPanel.id = 'worker-assignment';
    workerPanel.style.cssText = 'position:absolute;top:200px;left:100px;width:300px;height:60px';
    document.body.appendChild(workerPanel);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  describe('isCompleted', () => {
    it('returns false when no onboarding key exists', () => {
      expect(manager().isCompleted()).toBe(false);
    });

    it('returns false when onboarding key has wrong value', () => {
      localStorage.setItem('the_swarm_onboarding', 'nope');
      expect(manager().isCompleted()).toBe(false);
    });

    it('returns true when onboarding is complete', () => {
      localStorage.setItem('the_swarm_onboarding', 'done');
      expect(manager().isCompleted()).toBe(true);
    });
  });

  describe('start', () => {
    it('shows the first tooltip when onboarding not complete', () => {
      const mgr = manager();
      mgr.start();

      const overlay = document.querySelector('.onboarding-overlay');
      expect(overlay).not.toBeNull();
      const text = document.querySelector('.onboarding-tooltip-text');
      expect(text?.textContent).toBe('Tap to lay an egg.');
    });

    it('does not show tooltip when onboarding is complete', () => {
      localStorage.setItem('the_swarm_onboarding', 'done');
      const mgr = manager();
      mgr.start();

      expect(document.querySelector('.onboarding-overlay')).toBeNull();
    });

    it('does not show tooltip when a save already exists (returning player)', () => {
      const mgr = manager(true);
      mgr.start();

      expect(document.querySelector('.onboarding-overlay')).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears the onboarding localStorage key', () => {
      localStorage.setItem('the_swarm_onboarding', 'done');
      manager().reset();
      expect(localStorage.getItem('the_swarm_onboarding')).toBeNull();
    });

    it('allows onboarding to start again after reset', () => {
      localStorage.setItem('the_swarm_onboarding', 'done');
      manager().reset();

      const mgr = manager();
      mgr.start();

      expect(document.querySelector('.onboarding-overlay')).not.toBeNull();
    });
  });

  describe('sequential progression', () => {
    it('shows first tooltip text on first start call', () => {
      const mgr = manager();
      mgr.start();

      const text = document.querySelector('.onboarding-tooltip-text');
      expect(text?.textContent).toBe('Tap to lay an egg.');
    });

    it('marks onboarding complete after dismissing all steps', () => {
      // Use fake timers to skip the 300ms delay between steps
      vi.useFakeTimers();

      const mgr = manager();
      mgr.start();

      expect(manager().isCompleted()).toBe(false);

      // Dismiss all 3 steps
      for (let i = 0; i < 3; i++) {
        const btn = document.querySelector('.onboarding-tooltip-dismiss') as HTMLElement;
        if (btn) {
          btn.click();
          // Advance past the 300ms setTimeout before showing next step
          vi.advanceTimersByTime(350);
        }
      }

      expect(manager().isCompleted()).toBe(true);

      vi.useRealTimers();
    });
  });
});
