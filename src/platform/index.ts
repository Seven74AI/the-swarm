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
import { createSettingsStore, type KeyValueStore, type SettingsStore } from './settings';

export interface Platform {
  readonly capabilities: Capabilities;
  readonly settings: SettingsStore;
  readonly haptics: Haptics;
  /** File download and page reload (Story 1.17). */
  readonly browser: Browser;
}

export interface WebPlatformEnv extends CapabilityEnv, BrowserEnv {
  readonly localStorage?: KeyValueStore;
}

/** `localStorage`, or null where reading it throws (blocked storage). */
function storageOf(env: WebPlatformEnv): KeyValueStore | null {
  try {
    return env.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createWebPlatform(env: WebPlatformEnv = typeof window === 'undefined' ? {} : window): Platform {
  const capabilities = detectCapabilities(env);
  const settings = createSettingsStore({ storage: storageOf(env), capabilities });
  const haptics = createWebHaptics({ navigator: env.navigator, enabled: () => settings.settings.value.haptics });
  const browser = createWebBrowser(env);
  return Object.freeze({ capabilities, settings, haptics, browser });
}
