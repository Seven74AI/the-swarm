/**
 * Notifications (Story 2.14, FR26, AR12, D9): a seam, with no web implementation.
 *
 * A closed web page can't detect anything (ADR 0002), so the web build shows
 * no notifications, never asks for permission and has no notifications
 * setting (owner decision, ADR 0004). A store build can swap in a Capacitor
 * local-notifications implementation here and schedule reminders at times
 * main predicts (an expedition's return, a finished research) when the page is
 * hidden, then cancel them when the player is back.
 *
 * Only main holds the service. No game layer receives it, so no outcome can
 * depend on it (tests/arch/architecture.test.ts, notificationsOutcome.test.ts).
 */

/** One reminder, delivered by the device at a predicted wall-clock time. */
export interface ScheduledNotification {
  /** Stable id: scheduling the same id again replaces the earlier one. */
  readonly id: string;
  /** When to deliver it, as epoch milliseconds (`Date.now()` time). */
  readonly atMs: number;
  readonly title: string;
  readonly body: string;
}

export interface Notifications {
  /** False on the web: nothing scheduled is ever delivered. */
  readonly available: boolean;
  schedule(notification: ScheduledNotification): void;
  cancel(id: string): void;
  cancelAll(): void;
}

export const noopNotifications: Notifications = Object.freeze({
  available: false,
  schedule: () => {},
  cancel: () => {},
  cancelAll: () => {},
});

/**
 * The web build's notifications: the no-op. It takes no browser environment on
 * purpose, so it can't reach `Notification` or a service worker by accident.
 */
export function createWebNotifications(): Notifications {
  return noopNotifications;
}
