import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebNotifications, noopNotifications, type Notifications } from '../../../src/platform/notifications';
import { createWebPlatform } from '../../../src/platform';

/**
 * Story 2.14 (FR26, AR12, D9): notifications have a seam but no web
 * implementation. The web build gets a no-op: it never asks for notification
 * permission and never shows one, even where the browser offers both.
 */

/** Browser notification APIs that record every call. */
function installNotificationSpies() {
  const requestPermission = vi.fn(async () => 'granted' as const);
  const constructed = vi.fn();
  class FakeNotification {
    static permission = 'granted';
    static requestPermission = requestPermission;
    constructor(title: string) {
      constructed(title);
    }
  }
  const showNotification = vi.fn(async () => undefined);
  const getNotifications = vi.fn(async () => []);
  const subscribe = vi.fn(async () => ({}));
  const registration = { showNotification, getNotifications, pushManager: { subscribe } };
  const serviceWorker = { ready: Promise.resolve(registration), getRegistration: vi.fn(async () => registration) };
  vi.stubGlobal('Notification', FakeNotification);
  Object.defineProperty(globalThis.navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
  const calls = () => requestPermission.mock.calls.length + constructed.mock.calls.length + showNotification.mock.calls.length + getNotifications.mock.calls.length + subscribe.mock.calls.length + serviceWorker.getRegistration.mock.calls.length;
  return { requestPermission, showNotification, calls, navigator: { serviceWorker } };
}

function exercise(n: Notifications): void {
  n.schedule({ id: 'expedition-1', atMs: Date.now() + 60_000, title: 'THE SWARM', body: 'THE SCOUTS ARE BACK.' });
  n.schedule({ id: 'research-2', atMs: Date.now() + 1, title: 'THE SWARM', body: 'RESEARCH DONE.' });
  n.cancel('expedition-1');
  n.cancel('never-scheduled');
  n.cancelAll();
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis.navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe('web Notifications (Story 2.14)', () => {
  it('is a no-op that says it is unavailable', () => {
    const n = createWebNotifications();
    expect(n.available).toBe(false);
    expect(() => exercise(n)).not.toThrow();
    expect(noopNotifications.available).toBe(false);
    expect(() => exercise(noopNotifications)).not.toThrow();
  });

  it('never calls Notification.requestPermission or showNotification, even where the browser has them', async () => {
    const spies = installNotificationSpies();
    const n = createWebNotifications();
    exercise(n);
    await Promise.resolve();
    expect(spies.requestPermission).not.toHaveBeenCalled();
    expect(spies.showNotification).not.toHaveBeenCalled();
    expect(spies.calls()).toBe(0);
  });

  it('createWebPlatform hands out the no-op and touches no notification API while booting', async () => {
    const spies = installNotificationSpies();
    const p = createWebPlatform({ navigator: spies.navigator as never, matchMedia: () => ({ matches: false }) });
    expect(p.notifications.available).toBe(false);
    exercise(p.notifications);
    await Promise.resolve();
    expect(spies.calls()).toBe(0);
  });
});
