# 0032. Notifications: a seam without a web implementation

- **Status:** accepted (2026-11-21)
- **Source:** Story 2.14 (#280) · FR26 · AR12 · arch D9 · ADR 0002, 0004, 0007, 0031

## Context

A closed web page runs nothing (ADR 0002), so it can't detect that an expedition returned or research finished.
Web notifications would also need a service worker push setup and a permission prompt. The owner removed
notifications from the web build (sprint change proposal, ADR 0004); a store build (Capacitor) may add local
notifications later, scheduled ahead of time at predicted moments.

## Decision

- **`Notifications`** (`src/platform/notifications.ts`, `platform.notifications`): `available`,
  `schedule({id, atMs, title, body})` (epoch ms; the same id replaces), `cancel(id)`, `cancelAll()`.
- **The web build gets the no-op** (`createWebNotifications()` returns `noopNotifications`, `available: false`).
  It takes no browser environment, so it can't reach `Notification` or a service worker by accident. Nothing asks
  for notification permission and settings have no notifications toggle (Story 1.27).
- **Only main holds it.** main cancels pending reminders when the player returns (the lifecycle `returned`
  signal). A store build adds scheduling on `hidden`, from predictions main computes. No game layer, ui/ or
  actions/ receives it, so no game outcome can depend on it.
- **Boundary tests** (`tests/arch/architecture.test.ts`): nothing in `src/` names a browser notification API
  (`Notification`, `requestPermission`, `showNotification`, `getNotifications`, `PushManager`, `pushManager`,
  `ServiceWorkerRegistration`), and nothing outside main and platform/ imports the seam (types included) or reads
  `.notifications`. `tests/unit/platform/notificationsOutcome.test.ts` runs the same state with and without a
  notification service and gets identical results. `tests/unit/build/pwaBuild.test.ts` checks that no emitted
  script, the service worker of ADR 0031 and its Workbox runtime included, asks for permission, shows a
  notification, subscribes to push or listens for `push` / `notificationclick`.

## Consequences

- A store build adds its implementation file in platform/ and lifts the API rule for that one file only, plus a
  settings toggle shown only where `available` is true.
- Predicting the times (expedition and research end, full storage) is left to that build; the web build computes
  nothing for it.
