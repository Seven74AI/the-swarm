import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import fc from 'fast-check';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { createResourceFeed } from '../../../../src/ui/shell/resourceFeed';
import { ResourceStrip } from '../../../../src/ui/shell/ResourceStrip';
import { createSheetController } from '../../../../src/ui/shell/SheetController';
import { WorkersTab } from '../../../../src/ui/wrkr/WorkersTab';
import { isStarving } from '../../../../src/systems/ResourceSystem';
import { TerritorySystem } from '../../../../src/systems/TerritorySystem';
import { testActions } from '../../helpers/actions';
import { makeState } from '../../helpers/makeState';

/**
 * #494: food is clamped at 0, so while the colony starves the stored amount
 * stops moving and a measured delta reads 0. The strip then shows the net rate
 * WRKR shows instead: falling, in warn, never a sign that disagrees with WRKR.
 */

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** A colony with no food left and a random workforce, some of it on GATHER. */
const colony = fc.record({
  phase: fc.constantFrom(Phase.COLONY, Phase.COMBAT),
  workers: fc.integer({ min: 1, max: 400 }),
  gatherShare: fc.integer({ min: 0, max: 100 }),
  ticks: fc.integer({ min: 0, max: 8 }),
});

describe('resource strip while starving (#494)', () => {
  it('shows food falling, with the same sign as WRKR’s net, whenever food is held at 0 by a deficit', () => {
    fc.assert(
      fc.property(colony, ({ phase, workers, gatherShare, ticks }) => {
        const gather = Math.floor((workers * gatherShare) / 100);
        const state = makeState({
          phase,
          resources: { workers, food: 0, nestCapacity: 10_000 },
          workersAssigned: { gather, tend: workers - gather },
        });
        fc.pre(isStarving(state, new TerritorySystem().getBonuses(state)));
        gameState.value = state;
        const feed = createResourceFeed();
        const { container } = render(
          <>
            <ResourceStrip feed={feed} sheets={createSheetController()} compact={false} />
            <WorkersTab actions={testActions()} />
          </>,
        );
        // Game time passes with the store clamped at 0: the stored amount never moves.
        for (let i = 0; i < ticks; i++) {
          act(() => {
            gameState.value = { ...gameState.value, stats: { ...gameState.value.stats, playTimeMs: gameState.value.stats.playTimeMs + 500 } };
            feed.sample();
          });
        }
        const delta = container.querySelector<HTMLElement>('[data-strip-cell="food"] [data-delta]')!;
        const net = container.querySelector<HTMLElement>('[data-net]')!;
        expect(net.dataset.trend).toBe('down');
        expect(delta.dataset.trend).toBe(net.dataset.trend);
        expect(delta.textContent!.startsWith('−')).toBe(true);
        cleanup();
      }),
      { numRuns: 60 },
    );
  });

  it('keeps the measured delta while food is in stock', () => {
    gameState.value = makeState({
      phase: Phase.COLONY,
      resources: { workers: 20, food: 500, nestCapacity: 10_000 },
      workersAssigned: { gather: 0, tend: 20 },
    });
    const feed = createResourceFeed();
    const { container } = render(<ResourceStrip feed={feed} sheets={createSheetController()} compact={false} />);
    // No game time has passed, so nothing was measured yet: food in stock is not clamped.
    expect(container.querySelector<HTMLElement>('[data-strip-cell="food"] [data-delta]')!.dataset.trend).toBe('flat');
  });
});
