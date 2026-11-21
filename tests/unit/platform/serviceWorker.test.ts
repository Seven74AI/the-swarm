import { describe, expect, it, vi } from 'vitest';
import {
  createServiceWorker,
  serviceWorkerWanted,
  type ServiceWorkerEnv,
  type ServiceWorkerOptions,
} from '../../../src/platform/serviceWorker';

/**
 * Story 2.13 (AR13, D10): the service worker precaches the game so it plays
 * offline. A new version installs in the background and WAITS: it takes over on
 * the next cold start, and nothing here ever reloads the page or tells a
 * waiting worker to skip waiting.
 */

class FakeWorker extends EventTarget {
  state = 'installing';
  readonly postMessage = vi.fn();
  become(state: string): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  active: FakeWorker | null = null;
  readonly update = vi.fn(async () => undefined);
  /** A new version is found: it starts installing. */
  found(): FakeWorker {
    const w = new FakeWorker();
    this.installing = w;
    this.dispatchEvent(new Event('updatefound'));
    return w;
  }
}

function fakeEnv(opts: { controlled?: boolean; registration?: FakeRegistration; fail?: boolean } = {}) {
  const registration = opts.registration ?? new FakeRegistration();
  const container = Object.assign(new EventTarget(), {
    controller: opts.controlled ? new FakeWorker() : null,
    register: vi.fn(async () => {
      if (opts.fail) throw new Error('blocked');
      return registration;
    }),
  });
  const reload = vi.fn();
  const env: ServiceWorkerEnv = { navigator: { serviceWorker: container }, location: { reload } };
  return { env, container, registration, reload };
}

function options(over: Partial<ServiceWorkerOptions> = {}): ServiceWorkerOptions & { onUpdateReady: ReturnType<typeof vi.fn>; onError: ReturnType<typeof vi.fn> } {
  return { enabled: true, url: '/the-swarm/sw.js', scope: '/the-swarm/', onUpdateReady: vi.fn(), onError: vi.fn(), ...over } as never;
}

describe('serviceWorkerWanted (Story 2.13)', () => {
  it('is always on in a production build', () => {
    expect(serviceWorkerWanted({ prod: true, search: '' })).toBe(true);
  });

  it('is off in dev and E2E builds unless the page opts in with ?sw=1', () => {
    expect(serviceWorkerWanted({ prod: false, search: '' })).toBe(false);
    expect(serviceWorkerWanted({ prod: false, search: '?debug=1' })).toBe(false);
    expect(serviceWorkerWanted({ prod: false, search: '?sw=1' })).toBe(true);
  });
});

describe('createServiceWorker (Story 2.13)', () => {
  it('registers nothing when not enabled', async () => {
    const f = fakeEnv();
    const status = await createServiceWorker(f.env).register(options({ enabled: false }));
    expect(status).toBe('off');
    expect(f.container.register).not.toHaveBeenCalled();
  });

  it('copes with a browser that has no service workers', async () => {
    const status = await createServiceWorker({ navigator: {} }).register(options());
    expect(status).toBe('unsupported');
    expect(await createServiceWorker({}).register(options())).toBe('unsupported');
  });

  it('registers the worker for the base path', async () => {
    const f = fakeEnv();
    const status = await createServiceWorker(f.env).register(options());
    expect(status).toBe('registered');
    expect(f.container.register).toHaveBeenCalledWith('/the-swarm/sw.js', { scope: '/the-swarm/' });
  });

  it('reports a failed registration and keeps the game running', async () => {
    const f = fakeEnv({ fail: true });
    const o = options();
    expect(await createServiceWorker(f.env).register(o)).toBe('failed');
    expect(o.onError).toHaveBeenCalledTimes(1);
    expect(o.onUpdateReady).not.toHaveBeenCalled();
  });

  it('says nothing about an update on the first install', async () => {
    const f = fakeEnv({ controlled: false });
    const o = options();
    await createServiceWorker(f.env).register(o);
    f.registration.found().become('installed');
    expect(o.onUpdateReady).not.toHaveBeenCalled();
  });

  it('tells main once when a new version has installed and waits, and never activates or reloads it', async () => {
    const f = fakeEnv({ controlled: true });
    const o = options();
    await createServiceWorker(f.env).register(o);
    const next = f.registration.found();
    expect(o.onUpdateReady).not.toHaveBeenCalled();
    next.become('installed');
    f.registration.waiting = next;
    expect(o.onUpdateReady).toHaveBeenCalledTimes(1);
    // Another version found later in the same session: still one notice.
    f.registration.found().become('installed');
    expect(o.onUpdateReady).toHaveBeenCalledTimes(1);
    // Even when the waiting worker takes over (another tab closed), the page is not reloaded.
    f.container.dispatchEvent(new Event('controllerchange'));
    expect(next.postMessage).not.toHaveBeenCalled();
    expect(f.reload).not.toHaveBeenCalled();
  });

  it('tells main about a version that was already waiting at load (a reload is not a cold start)', async () => {
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    registration.waiting.state = 'installed';
    const f = fakeEnv({ controlled: true, registration });
    const o = options();
    await createServiceWorker(f.env).register(o);
    expect(o.onUpdateReady).toHaveBeenCalledTimes(1);
    expect(registration.waiting.postMessage).not.toHaveBeenCalled();
  });

  it('checks for a new version on request, and ignores a check that fails offline', async () => {
    const f = fakeEnv({ controlled: true });
    const sw = createServiceWorker(f.env);
    await sw.checkForUpdate(); // before registering: nothing to check
    expect(f.registration.update).not.toHaveBeenCalled();
    await sw.register(options());
    f.registration.update.mockRejectedValueOnce(new Error('offline'));
    await expect(sw.checkForUpdate()).resolves.toBeUndefined();
    expect(f.registration.update).toHaveBeenCalledTimes(1);
  });
});
