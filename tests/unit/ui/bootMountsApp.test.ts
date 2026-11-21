import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Story 1.7: boot renders the Preact `App` into #app. Since Story 1.36 every
 * panel is a Preact view inside the tab shell (UIRoot is gone).
 */
describe('boot mounts the Preact root', () => {
  beforeAll(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await import('../../../src/main');
    (window as unknown as { __swarm: { loop: { stop(): void } } }).__swarm.loop.stop();
  });

  it('renders App into #app: the tab shell, with the boot phase\'s panels drawn at once', () => {
    const app = document.getElementById('app')!;
    const shell = app.querySelector('[data-shell]');
    expect(shell).not.toBeNull();
    expect(shell!.parentElement).toBe(app);
    // The panels keep their ids under #app.
    expect(shell!.querySelector('#top-bar')).not.toBeNull();
    expect(shell!.querySelector('#phase-indicator')).not.toBeNull();
    expect(shell!.querySelector('#activity-log')).not.toBeNull();
    expect(app.querySelector('#panels')).not.toBeNull();
  });
});
