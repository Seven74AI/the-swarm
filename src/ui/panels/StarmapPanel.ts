/**
 * StarmapPanel — Phase 4 placeholder.
 * Star map interface coming in future update.
 */
export class StarmapPanel {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'starmap-panel';
    this.container.className = 'panel starmap-panel';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🌟 Star Map';
    this.container.appendChild(title);

    const placeholder = document.createElement('div');
    placeholder.className = 'panel-placeholder';
    placeholder.textContent = 'Star map coming soon...';
    this.container.appendChild(placeholder);
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
