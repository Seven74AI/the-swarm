/**
 * OnboardingTooltip — A positioned tooltip overlay for onboarding.
 *
 * Creates a backdrop overlay with a tooltip near the target element.
 * The user dismisses it via the "Got it!" button.
 *
 * DOM structure:
 *   <div class="onboarding-overlay">
 *     <div class="onboarding-tooltip onboarding-tooltip--<position>">
 *       <span class="onboarding-tooltip-arrow"></span>
 *       <p class="onboarding-tooltip-text">Tip text</p>
 *       <button class="onboarding-tooltip-dismiss btn">Got it!</button>
 *     </div>
 *   </div>
 */

export interface TooltipConfig {
  /** Unique ID for this tooltip step. */
  id: string;
  /** CSS selector to find the target element to point at. */
  targetSelector: string;
  /** Tooltip body text. */
  text: string;
  /**
   * Preferred position relative to target: 'below', 'above', 'right', 'left'.
   * Falls back to 'below' if target not found or at viewport edge.
   */
  position?: 'below' | 'above' | 'right' | 'left';
}

export class OnboardingTooltip {
  private overlay: HTMLElement;
  private tooltip: HTMLElement;
  private config: TooltipConfig;
  private onDismissCallback: (() => void) | null = null;

  constructor(config: TooltipConfig) {
    this.config = config;
    this.overlay = this.buildOverlay();
    this.tooltip = this.buildTooltip();
    this.overlay.appendChild(this.tooltip);
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    return overlay;
  }

  private buildTooltip(): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';

    const arrow = document.createElement('span');
    arrow.className = 'onboarding-tooltip-arrow';

    const text = document.createElement('p');
    text.className = 'onboarding-tooltip-text';
    text.textContent = this.config.text;

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'onboarding-tooltip-dismiss btn';
    dismissBtn.textContent = 'Got it!';
    dismissBtn.addEventListener('click', () => this.dismiss());

    tooltip.appendChild(arrow);
    tooltip.appendChild(text);
    tooltip.appendChild(dismissBtn);

    return tooltip;
  }

  /**
   * Register a callback invoked when the user dismisses this tooltip.
   */
  onDismiss(callback: () => void): void {
    this.onDismissCallback = callback;
  }

  /**
   * Dismiss the tooltip: remove from DOM and invoke the onDismiss callback.
   */
  dismiss(): void {
    this.removeFromDOM();
    if (this.onDismissCallback) {
      this.onDismissCallback();
    }
  }

  /**
   * Mount the tooltip to the document body, positioned near the target element.
   */
  mount(): void {
    const target = document.querySelector(this.config.targetSelector) as HTMLElement | null;
    const position = this.config.position ?? 'below';

    if (target) {
      this.positionNear(target, position);
    } else {
      // Fallback: center of viewport
      this.tooltip.classList.add('onboarding-tooltip--center');
    }

    document.body.appendChild(this.overlay);
  }

  /**
   * Position the tooltip near the target element.
   */
  private positionNear(target: HTMLElement, position: string): void {
    const targetRect = target.getBoundingClientRect();

    // Position the overlay (invisible) to cover the whole page
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';

    // Position the tooltip
    this.tooltip.classList.add(`onboarding-tooltip--${position}`);

    switch (position) {
      case 'below':
        this.tooltip.style.top = `${targetRect.bottom + 12}px`;
        this.tooltip.style.left = `${targetRect.left + targetRect.width / 2}px`;
        this.tooltip.style.transform = 'translateX(-50%)';
        break;
      case 'above':
        this.tooltip.style.top = `${targetRect.top - 12}px`;
        this.tooltip.style.left = `${targetRect.left + targetRect.width / 2}px`;
        this.tooltip.style.transform = 'translate(-50%, -100%)';
        break;
      case 'right':
        this.tooltip.style.top = `${targetRect.top + targetRect.height / 2}px`;
        this.tooltip.style.left = `${targetRect.right + 12}px`;
        this.tooltip.style.transform = 'translateY(-50%)';
        break;
      case 'left':
        this.tooltip.style.top = `${targetRect.top + targetRect.height / 2}px`;
        this.tooltip.style.left = `${targetRect.left - 12}px`;
        this.tooltip.style.transform = 'translate(-100%, -50%)';
        break;
    }
  }

  private removeFromDOM(): void {
    if (this.overlay.parentNode) {
      this.overlay.remove();
    }
  }

  /** Get the root element (for testing). */
  getElement(): HTMLElement {
    return this.overlay;
  }

  /** Get the tooltip inner element (for testing). */
  getTooltipElement(): HTMLElement {
    return this.tooltip;
  }
}
