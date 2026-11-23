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

function area(feed?: () => { readonly ok: boolean }) {
  return render(
    <>
      <NestSceneArea lay={() => ({ ok: true })} feed={feed} sheets={sheets} />
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

  it('from Colony on, tapping the brood feeds it and opens no peek; it is named "Feed the brood" (Story 9.4)', () => {
    const actions = testActions();
    gameState.value = makeState({ phase: Phase.COLONY, resources: { eggs: 3, larvae: 4, workers: 7, nestCapacity: 20 }, larvaPipeline: { count: 4, progress: 0 } });
    const c = area(actions.feed);
    const brood = c.querySelector<HTMLButtonElement>('button[data-chamber="brood"]')!;
    expect(brood.getAttribute('aria-label')).toMatch(/^Feed the brood/);
    expect(brood.getAttribute('aria-disabled')).not.toBe('true');
    act(() => {
      fireEvent.click(brood);
    });
    expect(gameState.value.resources.workers).toBeGreaterThan(7);
    expect(document.querySelector('[data-chamber-peek="brood"]')).toBeNull();
    // The label says it, and the counts stay in it.
    expect(brood.textContent).toMatch(/^FEED THE BROOD/);
    expect(brood.textContent).toMatch(/EGG/);
    // The workers chamber keeps its peek.
    act(() => {
      fireEvent.click(c.querySelector('button[data-chamber="workers"]')!);
    });
    expect(document.querySelector('[data-chamber-peek="workers"]')).not.toBeNull();
  });

  it('from Colony on the brood says why it cannot feed: a full nest, or no larvae; DIG stays the move', () => {
    const actions = testActions();
    gameState.value = makeState({ phase: Phase.COLONY, resources: { larvae: 4, workers: 20, nestCapacity: 20 }, larvaPipeline: { count: 4, progress: 0 } });
    let c = area(actions.feed);
    let brood = c.querySelector<HTMLButtonElement>('button[data-chamber="brood"]')!;
    expect(brood.getAttribute('aria-disabled')).toBe('true');
    expect(c.querySelector('[data-feed-reason]')!.textContent).toMatch(/^FEED\s*·.*NEST FULL$/);
    expect(brood.getAttribute('aria-label')).toMatch(/nest full/);
    const before = gameState.value;
    act(() => {
      fireEvent.click(brood);
    });
    expect(gameState.value).toBe(before);
    expect(document.querySelector('[data-chamber-peek="brood"]')).toBeNull();
    cleanup();
    gameState.value = makeState({ phase: Phase.COLONY, resources: { larvae: 0, workers: 5, nestCapacity: 20 } });
    c = area(actions.feed);
    brood = c.querySelector<HTMLButtonElement>('button[data-chamber="brood"]')!;
    expect(brood.getAttribute('aria-disabled')).toBe('true');
    expect(c.querySelector('[data-feed-reason]')!.textContent).toMatch(/^FEED\s*·.*NO LARVAE$/);
  });

  it('Phase 1 keeps the brood peek and has no FEED', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { larvae: 4, workers: 2 } });
    const c = area(testActions().feed);
    expect(c.querySelector('button[data-chamber="brood"]')!.getAttribute('aria-label')).toMatch(/^Brood/);
    expect(c.querySelector('[data-feed-reason]')).toBeNull();
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

  it('hands the scene its starving flag, so a starving colony thins while the label keeps the count (Story 8.7)', () => {
    gameState.value = makeState({ resources: { eggs: 0, larvae: 0, workers: 30, food: 0 }, workersAssigned: { gather: 0, tend: 30, dig: 0, guard: 0, researchers: 0 } });
    const c = area();
    expect(c.querySelector('[data-scene="nest"]')!.hasAttribute('data-starving')).toBe(true);
    expect(c.querySelector('[data-chamber="workers"]')!.textContent).toContain('30');
  });

  it('hands the scene the rooms dug, so it frames them (Story 9.6)', () => {
    vi.useFakeTimers();
    gameState.value = makeState({ phase: Phase.COLONY, resources: { workers: 5 }, dig: { roomsDug: 2, progress: 0, carry: 0, roomsByHand: 2, auto: false } });
    const c = area();
    expect(c.querySelectorAll('[data-scene-part="room"]')).toHaveLength(2);
    const s = gameState.value;
    act(() => {
      gameState.value = { ...s, dig: { ...s.dig, roomsDug: 3 } };
    });
    act(() => {
      vi.advanceTimersByTime(sceneBalance.viewRefreshMs);
    });
    expect(c.querySelectorAll('[data-scene-part="room"]')).toHaveLength(3);
  });
});
