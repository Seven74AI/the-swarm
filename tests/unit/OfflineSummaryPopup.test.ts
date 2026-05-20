import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineSummaryPopup } from '../../src/ui/components/OfflineSummaryPopup';
import type { OfflineLoadInfo } from '../../src/persistence/SaveManager';

describe('OfflineSummaryPopup', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  function createOfflineInfo(overrides: Partial<OfflineLoadInfo> = {}): OfflineLoadInfo {
    return {
      elapsedMs: 11_640_000, // 3h 14m
      effectiveMs: 11_640_000,
      offlineTicks: 116_400, // 3h14m at 50% efficiency with 50ms ticks
      efficiency: 0.5,
      ...overrides,
    };
  }

  it('creates a popup element with correct CSS class', () => {
    const popup = new OfflineSummaryPopup(createOfflineInfo(), () => {});
    const el = popup.getElement();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('offline-summary-popup')).toBe(true);
  });

  it('displays the correct duration for hours and minutes', () => {
    const info = createOfflineInfo({ elapsedMs: 3 * 3_600_000 + 14 * 60_000 }); // 3h 14m
    const popup = new OfflineSummaryPopup(info, () => {});
    const el = popup.getElement();

    expect(el.textContent).toContain('3h 14m');
  });

  it('displays minutes-only duration when less than 1 hour', () => {
    const info = createOfflineInfo({ elapsedMs: 45 * 60_000 }); // 45m
    const popup = new OfflineSummaryPopup(info, () => {});
    const el = popup.getElement();

    expect(el.textContent).toContain('45m');
  });

  it('displays seconds-only duration when less than 1 minute', () => {
    const info = createOfflineInfo({ elapsedMs: 45_000 }); // 45s
    const popup = new OfflineSummaryPopup(info, () => {});
    const el = popup.getElement();

    expect(el.textContent).toContain('45s');
  });

  it('shows a welcome message', () => {
    const popup = new OfflineSummaryPopup(createOfflineInfo(), () => {});
    const el = popup.getElement();

    expect(el.textContent).toContain('You were gone for');
  });

  it('has a dismiss button', () => {
    const popup = new OfflineSummaryPopup(createOfflineInfo(), () => {});
    const el = popup.getElement();
    const button = el.querySelector('button');

    expect(button).not.toBeNull();
    expect(button!.textContent).toMatch(/return|continue/i);
  });

  it('calls onDismiss callback when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const popup = new OfflineSummaryPopup(createOfflineInfo(), onDismiss);
    const el = popup.getElement();
    const button = el.querySelector('button')!;

    button.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('removes itself from DOM when dismissed', () => {
    const popup = new OfflineSummaryPopup(createOfflineInfo(), () => {});
    const el = popup.getElement();
    document.body.appendChild(el);

    expect(document.body.contains(el)).toBe(true);

    popup.dismiss();
    expect(document.body.contains(el)).toBe(false);
  });

  it('mounts to a specific parent element', () => {
    const popup = new OfflineSummaryPopup(createOfflineInfo(), () => {});
    const parent = document.createElement('div');
    popup.mount(parent);
    const el = popup.getElement();

    expect(parent.contains(el)).toBe(true);
  });

  it('cleanup removes DOM element and overlay', () => {
    const popup = new OfflineSummaryPopup(createOfflineInfo(), () => {});
    const el = popup.getElement();
    popup.mount(document.body);

    // Verify overlay and popup are in DOM
    const overlay = document.querySelector('.offline-overlay');
    expect(overlay).not.toBeNull();
    expect(document.body.contains(el)).toBe(true);

    popup.cleanup();

    expect(document.body.contains(el)).toBe(false);
    expect(document.querySelector('.offline-overlay')).toBeNull();
  });
});
