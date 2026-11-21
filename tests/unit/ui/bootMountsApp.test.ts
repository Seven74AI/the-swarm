import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Story 1.7: boot renders the Preact `App` into #app, and `App` hosts the
 * legacy `UIRoot`, so the legacy panels still end up under #app.
 */
describe('boot mounts the Preact root', () => {
  beforeAll(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await import('../../../src/main');
    (window as unknown as { __swarm: { loop: { stop(): void } } }).__swarm.loop.stop();
  });

  it('renders App into #app, which hosts the legacy UI', () => {
    const app = document.getElementById('app')!;
    const host = app.querySelector('[data-legacy-ui]');
    expect(host).not.toBeNull();
    expect(host!.parentElement).toBe(app);
    // Legacy panels keep their ids under #app.
    expect(host!.querySelector('#top-bar')).not.toBeNull();
    expect(app.querySelector('#panels')).not.toBeNull();
  });
});
