/**
 * The service worker (Story 2.13, AR13, D10): vite-plugin-pwa generates it at
 * build time and it precaches every asset, so the game opens and plays with no
 * connection.
 *
 * Update rule: a new version installs in the background and WAITS. It takes
 * over on the next cold start (once no page of the old version is open), and
 * never mid-session: nothing here reloads the page, listens for a controller
 * change, or tells a waiting worker to skip waiting. A plain reload is not a
 * cold start, so a version found earlier is still waiting after one; main is
 * told about it once per session.
 *
 * Registration is a production-build feature. Dev and E2E builds register only
 * when the page opts in with `?sw=1` (the offline E2E spec does), so the dev
 * server and every other E2E spec run without a worker.
 */

interface WorkerLike {
  readonly state: string;
  addEventListener(type: 'statechange', listener: () => void): void;
}

interface RegistrationLike {
  readonly installing: WorkerLike | null;
  readonly waiting: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
  update(): Promise<unknown>;
}

interface ContainerLike {
  readonly controller: unknown;
  register(url: string, options: { scope: string }): Promise<RegistrationLike>;
}

export interface ServiceWorkerEnv {
  readonly navigator?: { readonly serviceWorker?: ContainerLike };
  /** Never used: listed so tests can prove the page is never reloaded. */
  readonly location?: { reload(): void };
}

export interface ServiceWorkerOptions {
  /** Production build, or `?sw=1` (see `serviceWorkerWanted`). */
  readonly enabled: boolean;
  /** The worker script, under the base path (`/the-swarm/sw.js`). */
  readonly url: string;
  /** The base path the worker controls (`/the-swarm/`). */
  readonly scope: string;
  /** A new version has installed and waits for the next cold start. Called at most once. */
  onUpdateReady(): void;
  /** Registration failed: the game runs on, online only. */
  onError?(error: unknown): void;
}

/** off: not wanted in this build · unsupported: no service workers here · failed: register threw. */
export type ServiceWorkerStatus = 'off' | 'unsupported' | 'registered' | 'failed';

export interface ServiceWorkerControl {
  register(options: ServiceWorkerOptions): Promise<ServiceWorkerStatus>;
  /** Ask the server for a new version now (e.g. on returning to the app). Never throws. */
  checkForUpdate(): Promise<void>;
}

/** Always in production; in dev and E2E builds only with `?sw=1`. */
export function serviceWorkerWanted(env: { readonly prod: boolean; readonly search: string }): boolean {
  if (env.prod) return true;
  try {
    return new URLSearchParams(env.search).get('sw') === '1';
  } catch {
    return false;
  }
}

export function createServiceWorker(env: ServiceWorkerEnv = typeof window === 'undefined' ? {} : window): ServiceWorkerControl {
  let registration: RegistrationLike | null = null;
  return {
    async register(options) {
      if (!options.enabled) return 'off';
      const container = env.navigator?.serviceWorker;
      if (!container) return 'unsupported';
      // A worker already controls the page: anything installed from now on is an update.
      const hadController = container.controller != null;
      let told = false;
      const ready = (): void => {
        if (told) return;
        told = true;
        options.onUpdateReady();
      };
      try {
        registration = await container.register(options.url, { scope: options.scope });
      } catch (error) {
        options.onError?.(error);
        return 'failed';
      }
      const reg = registration;
      if (hadController && reg.waiting) ready();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && hadController) ready();
        });
      });
      return 'registered';
    },
    async checkForUpdate() {
      if (!registration) return;
      try {
        await registration.update();
      } catch {
        // Offline, or the server is unreachable: the next check tries again.
      }
    },
  };
}
