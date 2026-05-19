import { formatNumber } from '../../utils/format';
import type { Store } from '../../state/Store';

/**
 * Displays a single numeric value with a label.
 * Subscribes to Store for automatic updates.
 */
export class NumberDisplay {
  private el: HTMLSpanElement;

  constructor(
    private store: Store,
    private path: string,
    private label: string,
  ) {
    this.el = document.createElement('span');
    this.el.className = 'number-display';
    this.render(store.read(path) as number);

    store.subscribe(path, (value) => this.render(value as number));
  }

  private render(value: number): void {
    this.el.textContent = `${this.label}: ${formatNumber(value)}`;
  }

  getElement(): HTMLSpanElement {
    return this.el;
  }
}
