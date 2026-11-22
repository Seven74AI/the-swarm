import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { NestSceneArea } from '../../../../src/ui/nest/NestSceneArea';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { sceneBalance } from '../../../../src/data/balance/scene';
import { formatFull } from '../../../../src/utils/format';
import { testActions } from '../../helpers/actions';
import { makeState } from '../../helpers/makeState';

/**
 * NEST's scene area: the nest scene (Story 8.5) in place of the Story 1.22
 * placeholder. After Phase 1 it keeps a secondary LAY EGG so eggs stay
 * producible; each chamber opens a peek sheet with that chamber's counts.
 */

const initial = gameState.value;
let sheets: SheetController;

function area() {
  return render(
    <>
      <NestSceneArea lay={() => ({ ok: true })} sheets={sheets} />
      <SheetHost sheets={sheets} />
    </>,
  ).container;
}

describe('NestSceneArea (Story 1.22, Story 8.5)', () => {
  beforeEach(() => {
    sheets = createSheetController();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    gameState.value = initial;
  });

  it('draws the nest scene in place of the placeholder, with no lay control in Phase 1', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { eggs: 3, larvae: 2, workers: 0 } });
    const c = area();
    expect(c.querySelector('[data-nest-scene]')).not.toBeNull();
    expect(c.querySelector('[data-nest-scene="placeholder"]')).toBeNull();
    expect(c.querySelector('[data-nest-scene] [data-scene="nest"]')!.getAttribute('aria-label')).toBe('Nest: 0 workers, 3 eggs, 2 larvae');
    expect(c.querySelector('#click-egg')).toBeNull();
  });

  it('holds a secondary LAY EGG after Phase 1, so eggs stay producible', () => {
    gameState.value = makeState({ phase: Phase.COLONY });
    const actions = testActions();
    const c = render(<NestSceneArea lay={() => actions.layEgg()} sheets={sheets} />).container;
    const btn = c.querySelector<HTMLButtonElement>('[data-nest-scene] #click-egg');
    expect(btn).not.toBeNull();
    expect(btn!.dataset.kind).toBe('secondary');
    const before = gameState.value.stats.totalEggsLaid;
    act(() => btn!.click());
    expect(gameState.value.stats.totalEggsLaid).toBeGreaterThan(before);
  });

  it('follows the colony at most every refresh period, never on every write', () => {
    vi.useFakeTimers();
    gameState.value = makeState({ resources: { eggs: 3, larvae: 2, workers: 5 } });
    const c = area();
    const label = () => c.querySelector('[data-scene="nest"]')!.getAttribute('aria-label');
    const s = gameState.value;
    act(() => {
      gameState.value = { ...s, resources: { ...s.resources, workers: 6 } };
    });
    const t = gameState.value;
    act(() => {
      gameState.value = { ...t, resources: { ...t.resources, workers: 7 } };
    });
    expect(label()).not.toContain('7 workers');
    act(() => {
      vi.advanceTimersByTime(sceneBalance.viewRefreshMs);
    });
    expect(label()).toContain('7 workers');
  });

  it("opens a peek sheet with the brood chamber's counts", () => {
    gameState.value = makeState({ resources: { eggs: 1234, larvae: 56, workers: 7 } });
    const c = area();
    act(() => {
      fireEvent.click(c.querySelector('button[data-chamber="brood"]')!);
    });
    const peek = document.querySelector('[data-sheet="peek"][data-chamber-peek="brood"]')!;
    expect(peek).not.toBeNull();
    expect(peek.querySelector('[data-sheet-header]')!.textContent).toMatch(/BROOD/);
    expect(peek.querySelector('[data-chamber-count="queen"]')!.textContent).toBe('1');
    expect(peek.querySelector('[data-chamber-count="eggs"]')!.textContent).toBe(formatFull(1234));
    expect(peek.querySelector('[data-chamber-count="larvae"]')!.textContent).toBe(formatFull(56));
  });

  it("opens a peek sheet with the worker chamber's counts, by role after Phase 1", () => {
    gameState.value = makeState({
      phase: Phase.COLONY,
      resources: { workers: 20 },
      workersAssigned: { gather: 8, tend: 4, dig: 0, guard: 2, researchers: 0 },
    });
    const c = area();
    act(() => {
      fireEvent.click(c.querySelector('button[data-chamber="workers"]')!);
    });
    const peek = document.querySelector('[data-sheet="peek"][data-chamber-peek="workers"]')!;
    expect(peek.querySelector('[data-chamber-count="workers"]')!.textContent).toBe('20');
    expect(peek.querySelector('[data-chamber-count="gather"]')!.textContent).toBe('8');
    expect(peek.querySelector('[data-chamber-count="free"]')).not.toBeNull();
  });
});
