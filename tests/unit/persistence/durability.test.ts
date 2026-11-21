import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../src/engine/EventBus';
import { Phase } from '../../../src/phases/phases';
import { bindDurability } from '../../../src/persistence/durability';
import type { Durability, PersistOutcome } from '../../../src/platform/storage/durability';
import { log } from '../../../src/utils/log';

/**
 * Story 2.12: the first meaningful play (the first committed phase, or a load
 * that is already past the first phase) asks for persistent storage once, logs
 * the answer, and opens the add-to-home-screen hint once where it is wanted.
 */

function fakeDurability(wantsHint = true): Durability & { requestPersist: ReturnType<typeof vi.fn>; seen: () => boolean } {
  let seen = false;
  const requestPersist = vi.fn(async (): Promise<PersistOutcome> => 'granted');
  return {
    requestPersist,
    status: () => null,
    wantsHomeScreenHint: () => wantsHint && !seen,
    markHomeScreenHintSeen: () => {
      seen = true;
    },
    seen: () => seen,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bindDurability (Story 2.12)', () => {
  it('does nothing while the first phase is still being played', () => {
    const bus = new EventBus();
    const durability = fakeDurability();
    const openHint = vi.fn();
    bindDurability({ bus, phase: () => Phase.EGG_LAYING, durability, openHint });
    expect(durability.requestPersist).not.toHaveBeenCalled();
    expect(openHint).not.toHaveBeenCalled();
  });

  it('asks for persistence once when the first phase is committed, and logs the answer', async () => {
    const bus = new EventBus();
    const durability = fakeDurability();
    const info = vi.spyOn(log, 'info');
    bindDurability({ bus, phase: () => Phase.EGG_LAYING, durability, openHint: () => {} });
    bus.emit('phase_committed', { from: Phase.EGG_LAYING, to: Phase.COLONY });
    bus.emit('phase_committed', { from: Phase.COLONY, to: Phase.COMBAT });
    await flush();
    expect(durability.requestPersist).toHaveBeenCalledTimes(1);
    expect(info.mock.calls.some(([scope, msg]) => scope === 'storage' && String(msg).includes('granted'))).toBe(true);
  });

  it('asks at once on a load that is already past the first phase', () => {
    const bus = new EventBus();
    const durability = fakeDurability();
    bindDurability({ bus, phase: () => Phase.COLONY, durability, openHint: () => {} });
    bus.emit('phase_committed', { from: Phase.COLONY, to: Phase.COMBAT });
    expect(durability.requestPersist).toHaveBeenCalledTimes(1);
  });

  it('opens the home-screen hint once, and marks it seen', () => {
    const bus = new EventBus();
    const durability = fakeDurability(true);
    const openHint = vi.fn();
    bindDurability({ bus, phase: () => Phase.EGG_LAYING, durability, openHint });
    bus.emit('phase_committed', { from: Phase.EGG_LAYING, to: Phase.COLONY });
    bus.emit('phase_committed', { from: Phase.COLONY, to: Phase.COMBAT });
    expect(openHint).toHaveBeenCalledTimes(1);
    expect(durability.seen()).toBe(true);
  });

  it('never opens the hint where it is not wanted (installed app, desktop, already seen)', () => {
    const bus = new EventBus();
    const openHint = vi.fn();
    bindDurability({ bus, phase: () => Phase.COLONY, durability: fakeDurability(false), openHint });
    expect(openHint).not.toHaveBeenCalled();
  });

  it('a failing persist request never throws into the event bus', async () => {
    const bus = new EventBus();
    const durability = fakeDurability(false);
    durability.requestPersist.mockImplementation(async () => 'failed');
    const warn = vi.spyOn(log, 'warn');
    bindDurability({ bus, phase: () => Phase.COLONY, durability, openHint: () => {} });
    await flush();
    expect(warn.mock.calls.some(([scope]) => scope === 'storage')).toBe(true);
  });
});
