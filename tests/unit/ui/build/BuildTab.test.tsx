import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { getBuildAction } from '../../../../src/systems/NextAction';
import { getBuildCost } from '../../../../src/systems/BuildingSystem';
import { getProjects } from '../../../../src/systems/ResearchSystem';
import { getUpgradeCost } from '../../../../src/systems/ResourceSystem';
import { BuildHeader } from '../../../../src/ui/build/BuildHeader';
import { BuildingCards } from '../../../../src/ui/build/BuildingCards';
import { ResearchCards } from '../../../../src/ui/build/ResearchCards';
import { ConverterCard } from '../../../../src/ui/build/ConverterCard';
import { BuildPrimary } from '../../../../src/ui/build/BuildPrimary';
import { ClickPowerCard } from '../../../../src/ui/nest/ClickPowerCard';
import { testActions } from '../../helpers/actions';
import { confirmSettings, holdFor } from '../../helpers/confirm';
import { makeState } from '../../helpers/makeState';

/**
 * Story 1.24 (UX-DR17, UX-DR18, UX-DR19): BUILD shows buildings, research and
 * the converter as cards (title with glyph and level change, effect line, cost
 * line with shortfall). The highlighted card's action is the tab's `> BUY`;
 * from Phase 2 the Click Power card lives here. With nothing affordable the
 * header reads `NEXT: <item> IN ~<time>`. A running research step shows a
 * meter and the time left, and cancels through HoldToConfirm for 50 % back.
 */

const initial = gameState.value;
const broke = { food: 0, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 };
const vcs = getProjects().find((p) => p.prerequisite === null)!;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  gameState.value = initial;
});

const building = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`[data-building="${id}"]`);
const research = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`[data-research-project="${id}"]`);

describe('Building cards (Story 1.24)', () => {
  it('draws one card per building: glyph, level change, effect and cost line', () => {
    gameState.value = makeState({ phase: Phase.EXPANSION });
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    for (const id of ['barracks', 'walls', 'warehouse', 'silk_weaving', 'chitin_armory', 'venom_lab']) {
      const el = building(container, id)!;
      expect(el, id).not.toBeNull();
      expect(el.querySelector('[data-card]'), id).not.toBeNull();
      expect(el.querySelector('.card__glyph'), id).not.toBeNull();
      expect(el.querySelector('.card__level')!.textContent, id).toMatch(/LV\.0 → 1/);
      expect(el.querySelector('.card__effect')!.textContent, id).not.toBe('');
      expect(el.querySelector('.card__cost')!.textContent, id).not.toBe('');
    }
  });

  it('shows the shortfall in warn while unaffordable, and an enabled BUY once affordable', () => {
    gameState.value = makeState({ phase: Phase.EXPANSION, resources: broke });
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    const walls = building(container, 'walls')!;
    expect(walls.querySelector('[data-shortfall]')!.textContent).toMatch(/needs \d+ more/);
    expect(walls.querySelector('button')!.getAttribute('aria-disabled')).toBe('true');

    const cost = getBuildCost('walls', 1);
    act(() => {
      gameState.value = makeState({ phase: Phase.EXPANSION, resources: { ...broke, stone: cost.stone } });
    });
    expect(walls.querySelector('[data-shortfall]')).toBeNull();
    expect(walls.querySelector('button')!.getAttribute('aria-disabled')).toBeNull();
  });

  it('BUY levels the building up through the action and the level line moves on', () => {
    const cost = getBuildCost('walls', 1);
    gameState.value = makeState({ phase: Phase.EXPANSION, resources: { ...broke, stone: cost.stone * 10 } });
    const actions = testActions();
    const { container } = render(<BuildingCards buy={(id) => actions.buyBuilding(id)} />);
    const before = gameState.value.resources.stone;
    act(() => building(container, 'walls')!.querySelector('button')!.click());
    expect(gameState.value.buildings.walls.level).toBeGreaterThan(0);
    expect(gameState.value.resources.stone).toBeLessThan(before);
    expect(building(container, 'walls')!.querySelector('.card__level')!.textContent).toMatch(/LV\.1 → 2/);
  });

  it('highlights exactly the card getBuildAction picks', () => {
    const cost = getBuildCost('walls', 1);
    gameState.value = makeState({ phase: Phase.EXPANSION, resources: { ...broke, stone: cost.stone } });
    const pick = getBuildAction(gameState.value);
    expect(pick.kind === 'act' && pick.key).toBe('building:walls');
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    const selected = container.querySelectorAll('[data-card][data-selected]');
    expect(selected.length).toBe(1);
    expect(building(container, 'walls')!.querySelector('[data-card]')!.hasAttribute('data-selected')).toBe(true);
  });
});

describe('Click Power on BUILD (Story 1.24, UX-DR18)', () => {
  const card = (root: ParentNode) => root.querySelector<HTMLElement>('[data-card="click_power"]');

  it('is on BUILD from Phase 2, even while unaffordable, and never in Phase 1', () => {
    gameState.value = makeState({ phase: Phase.COLONY, resources: broke });
    const { container } = render(<ClickPowerCard place="build" buy={() => ({ ok: true })} />);
    expect(card(container)).not.toBeNull();
    expect(card(container)!.querySelector('[data-shortfall]')).not.toBeNull();
    act(() => {
      gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1_000_000 } });
    });
    expect(card(container)).toBeNull();
  });

  it('is the highlighted card when it is BUILD\'s pick', () => {
    gameState.value = makeState({ phase: Phase.COLONY, resources: { ...broke, food: getUpgradeCost('click_power', 0)! } });
    const { container } = render(<ClickPowerCard place="build" buy={() => ({ ok: true })} />);
    expect(card(container)!.hasAttribute('data-selected')).toBe(true);
  });
});

describe('BUILD header and primary action (Story 1.24)', () => {
  it('reads NEXT: <item> IN ~<time> when nothing is affordable, BUILD otherwise', () => {
    gameState.value = makeState({
      phase: Phase.COLONY,
      resources: { ...broke, workers: 10 },
      workersAssigned: { gather: 10, tend: 0, dig: 0, guard: 0, researchers: 0 },
    });
    const { container } = render(<BuildHeader />);
    const header = container.querySelector('[data-build-header]')!;
    expect(header.textContent).toMatch(/^NEXT: CLICK POWER IN ~\S+/);
    act(() => {
      gameState.value = makeState({ phase: Phase.COLONY, resources: { food: 1_000_000 } });
    });
    expect(header.textContent).toBe('BUILD');
  });

  it('> BUY buys the highlighted card', () => {
    const cost = getBuildCost('walls', 1);
    gameState.value = makeState({ phase: Phase.EXPANSION, resources: { ...broke, stone: cost.stone } });
    const actions = testActions();
    const { container } = render(<BuildPrimary perform={(i) => actions.perform(i)} />);
    const btn = container.querySelector<HTMLButtonElement>('[data-action="buy-highlighted"]')!;
    expect(btn.textContent).toContain('BUY');
    expect(btn.textContent).toContain('WALLS');
    act(() => btn.click());
    expect(gameState.value.buildings.walls.level).toBeGreaterThan(0);
  });

  it('is empty when nothing is affordable (the header names what comes next)', () => {
    gameState.value = makeState({ phase: Phase.EXPANSION, resources: broke });
    const { container } = render(<BuildPrimary perform={() => ({ ok: true })} />);
    expect(container.querySelector('[data-action="buy-highlighted"]')).toBeNull();
    expect(container.textContent).toBe('');
  });
});

describe('Research cards (Story 1.24, UX-DR19)', () => {
  const space = (over: Parameters<typeof makeState>[0] = {}) =>
    makeState({ phase: Phase.SPACE, resources: { workers: 200, stone: 10_000, nectar: 10_000 }, ...over });

  it('draws one card per chain step with its status', () => {
    gameState.value = space();
    const { container } = render(<ResearchCards start={() => ({ ok: true })} cancel={() => ({ ok: true })} confirmSettings={confirmSettings()} />);
    for (const p of getProjects()) {
      const el = research(container, p.id)!;
      expect(el, p.id).not.toBeNull();
      expect(el.getAttribute('data-research-status'), p.id).toBe(p.prerequisite ? 'locked' : 'available');
      expect(el.querySelector('.card__level')!.textContent, p.id).toMatch(/STEP \d\/\d/);
    }
  });

  it('START is disabled with the reason while too few researchers are assigned', () => {
    gameState.value = space({ workersAssigned: { researchers: 0 } });
    const { container } = render(<ResearchCards start={() => ({ ok: true })} cancel={() => ({ ok: true })} confirmSettings={confirmSettings()} />);
    const btn = research(container, vcs.id)!.querySelector('button')!;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(research(container, vcs.id)!.textContent).toMatch(/RESEARCHERS/);
  });

  it('START runs one chain step: a progress meter and the time left appear', () => {
    gameState.value = space({ workersAssigned: { researchers: vcs.requiredResearchers } });
    const actions = testActions();
    const { container } = render(
      <ResearchCards start={(id) => actions.startResearch(id)} cancel={(id) => actions.cancelResearch(id)} confirmSettings={confirmSettings()} />,
    );
    act(() => research(container, vcs.id)!.querySelector('button')!.click());
    const el = research(container, vcs.id)!;
    expect(el.getAttribute('data-research-status')).toBe('in_progress');
    expect(el.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(el.querySelector('[data-time-left]')!.textContent).toMatch(/LEFT/);
  });

  it('while running, CANCEL (50 % BACK) shows the refund before confirming, and holding it refunds half', () => {
    vi.useFakeTimers();
    gameState.value = space({
      workersAssigned: { researchers: vcs.requiredResearchers },
      research: { projects: { [vcs.id]: { status: 'running', progressMs: 0, durationMs: vcs.durationMs } } },
    });
    const actions = testActions();
    const settings = confirmSettings();
    const { container } = render(
      <ResearchCards start={(id) => actions.startResearch(id)} cancel={(id) => actions.cancelResearch(id)} confirmSettings={settings} />,
    );
    const cancel = research(container, vcs.id)!.querySelector<HTMLButtonElement>('[data-action="cancel-research"]')!;
    expect(cancel.getAttribute('aria-label')).toContain('CANCEL (50 % BACK)');
    const refund = research(container, vcs.id)!.querySelector('[data-refund]')!;
    for (const [res, amount] of Object.entries(vcs.cost)) {
      if (Math.floor((amount as number) / 2) > 0) expect(refund.textContent).toContain(String(Math.floor((amount as number) / 2)));
      void res;
    }
    const before = { ...gameState.value.resources };
    // A short press does nothing: cancelling is irreversible.
    act(() => holdFor(cancel, settings.value.confirmHoldMs / 4));
    expect(gameState.value.research.projects[vcs.id].status).toBe('running');
    act(() => holdFor(cancel, settings.value.confirmHoldMs + 100));
    expect(gameState.value.research.projects[vcs.id].status).not.toBe('running');
    for (const [res, amount] of Object.entries(vcs.cost)) {
      const key = res as keyof typeof before;
      expect(gameState.value.resources[key]).toBe((before[key] as number) + Math.floor((amount as number) / 2));
    }
  });

  it('a done step reads DONE and offers no action', () => {
    gameState.value = space({ research: { projects: { [vcs.id]: { status: 'done' } } } });
    const { container } = render(<ResearchCards start={() => ({ ok: true })} cancel={() => ({ ok: true })} confirmSettings={confirmSettings()} />);
    const el = research(container, vcs.id)!;
    expect(el.getAttribute('data-research-status')).toBe('completed');
    expect(el.querySelector('button')).toBeNull();
    expect(el.textContent).toContain('DONE');
  });
});

describe('Converter card (Story 1.24)', () => {
  it('lists every conversion step, locked until its research is done', () => {
    gameState.value = makeState({ phase: Phase.SPACE });
    const { container } = render(<ConverterCard convert={() => ({ ok: true })} />);
    const steps = container.querySelectorAll('[data-conversion]');
    expect(steps.length).toBe(3);
    for (const step of steps) expect(step.getAttribute('data-unlocked')).toBe('false');
    expect(container.querySelector('button')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('CONVERT runs the unlocked steps once through the action', () => {
    gameState.value = makeState({
      phase: Phase.SPACE,
      resources: { stone: 1000, nectar: 1000, workers: 100 },
      workersAssigned: { researchers: 50 },
      research: { projects: { [vcs.id]: { status: 'done' } } },
    });
    const actions = testActions();
    const { container } = render(<ConverterCard convert={() => actions.runConversions()} />);
    expect(container.querySelector(`[data-conversion="${vcs.id}"]`)!.getAttribute('data-unlocked')).toBe('true');
    const before = gameState.value.resources.voidCrystals;
    act(() => container.querySelector('button')!.click());
    expect(gameState.value.resources.voidCrystals).toBeGreaterThan(before);
  });
});
