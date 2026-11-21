/**
 * When the save asks to be kept (Story 2.12; AR6, architecture D4 → Durability).
 *
 * The first meaningful play is the first committed phase: the first
 * `phase_committed`, or a load that is already past the first phase (a run
 * saved by an earlier build). Then, once per load:
 * - persistent storage is requested (`platform.durability`, which asks the
 *   browser at most once ever) and the outcome is logged under `storage`;
 * - the add-to-home-screen hint opens, if the platform wants it (a mobile
 *   browser that isn't the installed app, hint never shown), and is marked seen.
 *
 * main binds it; the durability service comes from platform/ as a type here.
 */
import type { EventBus } from '../engine/EventBus';
import { Phase } from '../phases/phases';
import type { Durability } from '../platform/storage/durability';
import { log } from '../utils/log';

export interface DurabilityBinding {
  readonly bus: EventBus;
  /** The current phase, read once at bind. */
  readonly phase: () => string;
  readonly durability: Durability;
  /** Open the one-time add-to-home-screen hint. */
  readonly openHint: () => void;
}

export function bindDurability({ bus, phase, durability, openHint }: DurabilityBinding): void {
  let done = false;
  const meaningfulPlay = (): void => {
    if (done) return;
    done = true;
    void durability.requestPersist().then((outcome) => {
      if (outcome === 'failed') log.warn('storage', 'persistent storage request failed');
      else log.info('storage', `persistent storage: ${outcome}`);
    });
    if (durability.wantsHomeScreenHint()) {
      durability.markHomeScreenHintSeen();
      openHint();
    }
  };
  if (phase() !== Phase.EGG_LAYING) meaningfulPlay();
  else bus.subscribe('phase_committed', meaningfulPlay);
}
