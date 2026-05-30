/**
 * Simple CSS progress bar with percentage text.
 */
export class ProgressBar {
  private container: HTMLDivElement;
  private fill: HTMLDivElement;
  private label: HTMLSpanElement;

  constructor(label: string) {
    this.container = document.createElement('div');
    this.container.className = 'progress-bar';

    const header = document.createElement('div');
    header.className = 'progress-header';

    const title = document.createElement('span');
    title.className = 'progress-label';
    title.textContent = label;

    this.label = document.createElement('span');
    this.label.className = 'progress-percent';

    header.appendChild(title);
    header.appendChild(this.label);

    const track = document.createElement('div');
    track.className = 'progress-track';

    this.fill = document.createElement('div');
    this.fill.className = 'progress-fill';
    track.appendChild(this.fill);

    this.container.appendChild(header);
    this.container.appendChild(track);
  }

  update(current: number, max: number, colorClass?: string): void {
    const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    this.fill.style.width = `${pct}%`;
    this.label.textContent = `${pct.toFixed(0)}%`;

    // Apply capacity-state color classes
    this.fill.classList.remove('capacity-warning', 'capacity-full');
    if (colorClass) {
      this.fill.classList.add(colorClass);
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
