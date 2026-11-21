import { test, expect, type Page } from '@playwright/test';

/**
 * Story 2.14 (FR26, D9): the web build has no notifications. Through a boot, a
 * hide and a return, and the settings screen, nothing asks for notification
 * permission or shows one, and settings offer no notifications toggle.
 *
 * Also run with Story 2.13's service worker installed.
 *
 * The browser's notification APIs are replaced before the page loads with
 * versions that record every call.
 */

async function recordNotificationCalls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('the_swarm_onboarding', 'done');
    const calls: string[] = [];
    (window as any).__notificationCalls = calls;
    class RecordingNotification {
      static get permission(): string {
        return 'default';
      }
      static requestPermission(): Promise<string> {
        calls.push('Notification.requestPermission');
        return Promise.resolve('denied');
      }
      constructor() {
        calls.push('new Notification');
      }
    }
    Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: RecordingNotification });
    const record = (proto: any, name: string, label: string): void => {
      if (!proto) return;
      proto[name] = function () {
        calls.push(label);
        return Promise.resolve(undefined);
      };
    };
    record((window as any).ServiceWorkerRegistration?.prototype, 'showNotification', 'showNotification');
    record((window as any).ServiceWorkerRegistration?.prototype, 'getNotifications', 'getNotifications');
    record((window as any).PushManager?.prototype, 'subscribe', 'PushManager.subscribe');
    record((window as any).PushManager?.prototype, 'permissionState', 'PushManager.permissionState');
  });
}

const callsOf = (page: Page) => page.evaluate(() => [...((window as any).__notificationCalls as string[])]);
const playTime = (page: Page) =>
  page.evaluate(() => (window as any).__swarm.manager.getState().stats.playTimeMs as number);

async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

test('the web build never asks for notification permission or shows one', async ({ page }) => {
  await recordNotificationCalls(page);
  await page.goto('/');
  await expect.poll(() => playTime(page), { timeout: 10_000 }).toBeGreaterThan(0);
  await expectNoNotifications(page);
});

// Story 2.13's service worker (opted in with ?sw=1 on the E2E bundle) adds no notifications either.
test('with the offline service worker running, still no permission request or notification', async ({ page }) => {
  await recordNotificationCalls(page);
  await page.goto('/the-swarm/?sw=1');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => playTime(page), { timeout: 10_000 }).toBeGreaterThan(0);
  await expectNoNotifications(page);
});

async function expectNoNotifications(page: Page): Promise<void> {
  expect(await page.evaluate(() => (window as any).__swarm.platform.notifications.available)).toBe(false);

  // Leaving and coming back is where a store build would schedule and cancel reminders.
  await setVisibility(page, 'hidden');
  await setVisibility(page, 'visible');
  const resumed = await playTime(page);
  await expect.poll(() => playTime(page)).toBeGreaterThan(resumed);

  // Settings: every option is there except a notifications toggle.
  await page.locator('[data-resource-strip]').click();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await expect(page.locator('[data-settings-sheet]')).toBeVisible();
  await expect(page.locator('[data-settings-sheet] [data-setting]').first()).toBeVisible();
  await expect(page.locator('[data-setting="notifications"]')).toHaveCount(0);
  await expect(page.locator('[data-settings-sheet]')).not.toContainText(/NOTIFICATION/i);

  expect(await callsOf(page)).toEqual([]);
}
