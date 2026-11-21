/**
 * The telemetry store (Story 3.10, FR38, NFR10; D4: outside the save, its own key).
 *
 * Kept behind platform/ like the save and the intro flag, so game code never
 * touches `localStorage`. Blocked, full or missing storage never throws:
 * `read` gives null and `write` false, and the buffer then lasts the session.
 */
import type { TelemetryStorage } from '../../state/telemetry';
import type { RemovableStore } from './SaveStore';

export const TELEMETRY_KEY = 'the_swarm_telemetry';

export type TelemetryStore = TelemetryStorage;

export function createTelemetryStore(storage: RemovableStore | null): TelemetryStore {
  return {
    read() {
      try {
        return storage?.getItem(TELEMETRY_KEY) ?? null;
      } catch {
        return null;
      }
    },
    write(text) {
      if (!storage) return false;
      try {
        storage.setItem(TELEMETRY_KEY, text);
        return true;
      } catch {
        return false;
      }
    },
  };
}
