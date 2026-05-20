/**
 * TechTreePanel — Phase 5 placeholder.
 * Tech tree interface coming in future update.
 */
export class TechTreePanel {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'tech-tree-panel';
    this.container.className = 'panel tech-tree-panel';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🌳 Tech Tree';
    this.container.appendChild(title);

    const placeholder = document.createElement('div');
    placeholder.className = 'panel-placeholder';
    placeholder.textContent = 'Tech tree coming soon...';
    this.container.appendChild(placeholder);
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
