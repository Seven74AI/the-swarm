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

export interface Platform {
  readonly capabilities: Capabilities;
  readonly settings: SettingsStore;
  readonly haptics: Haptics;
  /** File download and page reload (Story 1.17). */
  readonly browser: Browser;
  /** Wide (desktop columns) or not (Story 1.29). */
  readonly viewport: Viewport;
  /** Where the save lives: primary, 2 rotating backups, the unreadable copy (Story 2.2, D4). */
  readonly saves: SaveStore;
  /** The intro (onboarding) flag, outside the save (Story 2.2, D4). */
  readonly introFlag: IntroFlag;
}

export interface WebPlatformEnv extends CapabilityEnv, BrowserEnv {
  /** Read by the capability probes and kept by the viewport for its change events. */
  readonly matchMedia?: ViewportEnv['matchMedia'];
  readonly localStorage?: RemovableStore;
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
  const browser = createWebBrowser(env);
  const viewport = createViewport(env);
  const saves = createLocalSaveStore(storage);
  const introFlag = createIntroFlag(storage);
  return Object.freeze({ capabilities, settings, haptics, browser, viewport, saves, introFlag });
}
