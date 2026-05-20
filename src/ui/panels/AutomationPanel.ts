/**
 * AutomationPanel — Phase 5 placeholder.
 * Automation interface coming in future update.
 */
export class AutomationPanel {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'automation-panel';
    this.container.className = 'panel automation-panel';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '⚙️ Automation';
    this.container.appendChild(title);

    const placeholder = document.createElement('div');
    placeholder.className = 'panel-placeholder';
    placeholder.textContent = 'Automation coming soon...';
    this.container.appendChild(placeholder);
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
