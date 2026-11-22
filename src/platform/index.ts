/**
 * Platform services for the web build (Story 1.10, D9).
 *
 * main builds them once at boot and passes them on; nothing else imports a
 * value from platform/ (tests/arch/architecture.test.ts). A store build would
 * swap in Capacitor implementations here.
 */
import { detectCapabilities, type Capabilities, type CapabilityEnv } from './capabilities';
import { createWebHaptics, type Haptics } from './haptics';
import { createWebBrowser, type Browser, type BrowserEnv } from './browser';
import { createSettingsStore, type SettingsStore } from './settings';
import { createViewport, type Viewport, type ViewportEnv } from './viewport';
import { createLocalSaveStore, type RemovableStore, type SaveStore } from './storage/SaveStore';
import { createIntroFlag, type IntroFlag } from './storage/introFlag';
import { createTelemetryStore, type TelemetryStore } from './storage/telemetryStore';
import { createDurability, type Durability, type StorageManagerLike } from './storage/durability';
import { createLifecycle, type Lifecycle, type LifecycleEnv } from './lifecycle';
import { createServiceWorker, type ServiceWorkerControl, type ServiceWorkerEnv } from './serviceWorker';
import { createWebNotifications, type Notifications } from './notifications';
import { createWebAudio, type Audio, type WebAudioEnv } from './audio';

export interface Platform {
  readonly capabilities: Capabilities;
  readonly settings: SettingsStore;
  readonly haptics: Haptics;
  /** Synthesized sound effects, off by default, no context before the first gesture (Story 8.8, FR42). */
  readonly audio: Audio;
  /** File download and page reload (Story 1.17). */
  readonly browser: Browser;
  /** Wide (desktop columns) or not (Story 1.29). */
  readonly viewport: Viewport;
  /** Where the save lives: primary, 2 rotating backups, the unreadable copy (Story 2.2, D4). */
  readonly saves: SaveStore;
  /** The intro (onboarding) flag, outside the save (Story 2.2, D4). */
  readonly introFlag: IntroFlag;
  /** The play-telemetry ring buffer's storage, outside the save (Story 3.10, FR38, NFR10). */
  readonly telemetry: TelemetryStore;
  /** Page hidden / returned signals for the one resume path (Story 2.3, D1). */
  readonly lifecycle: Lifecycle;
  /** Persistent storage and the one-time add-to-home-screen hint (Story 2.12, D4). */
  readonly durability: Durability;
  /** Offline play: registers the precaching service worker; updates wait for a cold start (Story 2.13, D10). */
  readonly serviceWorker: ServiceWorkerControl;
  /**
   * Reminders at predicted times, for a store build (Story 2.14, D9). The web
   * build's is a no-op: no permission request, no notifications, no setting.
   */
  readonly notifications: Notifications;
}

export interface WebPlatformEnv extends CapabilityEnv, BrowserEnv, Omit<LifecycleEnv, 'document'> {
  /** Read by the capability probes and kept by the viewport for its change events. */
  readonly matchMedia?: ViewportEnv['matchMedia'];
  readonly navigator?: CapabilityEnv['navigator'] & { readonly storage?: StorageManagerLike };
  readonly localStorage?: RemovableStore;
  /** The browser's file helpers and the capability probes' text-scale read share it. */
  readonly document?: NonNullable<BrowserEnv['document']> & NonNullable<CapabilityEnv['document']>;
}

/** `navigator.storage`, or undefined where it is missing or reading it throws. */
function storageManagerOf(env: WebPlatformEnv): StorageManagerLike | undefined {
  try {
    return env.navigator?.storage ?? undefined;
  } catch {
    return undefined;
  }
}

/** `localStorage`, or null where reading it throws (blocked storage). */
function storageOf(env: WebPlatformEnv): RemovableStore | null {
  try {
    return env.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createWebPlatform(env: WebPlatformEnv = typeof window === 'undefined' ? {} : window): Platform {
  const capabilities = detectCapabilities(env);
  const storage = storageOf(env);
  const settings = createSettingsStore({ storage, capabilities });
  const haptics = createWebHaptics({ navigator: env.navigator, enabled: () => settings.settings.value.haptics });
  // Gestures are listened for on the window; Web Audio comes from it too.
  const audio = createWebAudio({ env: env as WebAudioEnv, enabled: () => settings.settings.value.sound });
  const browser = createWebBrowser(env);
  const viewport = createViewport(env);
  const saves = createLocalSaveStore(storage);
  const introFlag = createIntroFlag(storage);
  const telemetry = createTelemetryStore(storage);
  const lifecycle = createLifecycle(env as LifecycleEnv);
  const durability = createDurability({ storageManager: storageManagerOf(env), storage, capabilities });
  const serviceWorker = createServiceWorker(env as ServiceWorkerEnv);
  const notifications = createWebNotifications();
  return Object.freeze({ capabilities, settings, haptics, audio, browser, viewport, saves, introFlag, telemetry, lifecycle, durability, serviceWorker, notifications });
}
