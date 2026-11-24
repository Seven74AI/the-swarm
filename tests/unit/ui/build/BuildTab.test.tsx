import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import { formatFull } from '../../../../src/utils/format';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { getBuildAction } from '../../../../src/systems/NextAction';
import { getBuildCost } from '../../../../src/systems/BuildingSystem';
import { OFFLINE_RESEARCH_ID, getProjects, getProjectsFor } from '../../../../src/systems/ResearchSystem';
import { getUpgradeCost } from '../../../../src/systems/ResourceSystem';
import { BuildHeader } from '../../../../src/ui/build/BuildHeader';
import { BuildingCards } from '../../../../src/ui/build/BuildingCards';
import { ResearchCards } from '../../../../src/ui/build/ResearchCards';
import { ConverterCard, ParticleLabCard } from '../../../../src/ui/build/ConverterCard';
import { getParticleLabCost } from '../../../../src/systems/ResourceConversionSystem';
import { BuildPrimary } from '../../../../src/ui/build/BuildPrimary';
import { ClickPowerCard } from '../../../../src/ui/nest/ClickPowerCard';
import { testActions } from '../../helpers/actions';
import { confirmSettings, holdFor } from '../../helpers/confirm';
import { makeState } from '../../helpers/makeState';
import { researchBalance } from '../../../../src/data/balance/research';
import { visibleText } from '../../helpers/a11y';

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
    for (const id of ['barracks', 'walls', 'warehouse', 'fungus_garden', 'tunnels', 'silk_weaving', 'chitin_armory', 'venom_lab', 'midden']) {
      const el = building(container, id)!;
      expect(el, id).not.toBeNull();
      expect(el.querySelector('[data-card]'), id).not.toBeNull();
      expect(el.querySelector('.card__glyph'), id).not.toBeNull();
      expect(visibleText(el.querySelector('.card__level')!), id).toMatch(/LV\.0 → 1/);
      expect(el.querySelector('.card__effect')!.textContent, id).not.toBe('');
      expect(el.querySelector('.card__cost')!.textContent, id).not.toBe('');
    }
  });

  it('shows the shortfall in warn while unaffordable, and an enabled BUY once affordable', () => {
    gameState.value = makeState({ phase: Phase.EXPANSION, resources: broke });
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    const walls = building(container, 'walls')!;
    expect(walls.querySelector('[data-shortfall]')!.textContent).toContain(`needs ${formatFull(getBuildCost('walls', 1).stone)} more`);
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
    expect(visibleText(building(container, 'walls')!.querySelector('.card__level')!)).toMatch(/LV\.1 → 2/);
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

describe('Building cards by phase (Story 3.5)', () => {
  const colonyOwn = ['barracks', 'walls', 'warehouse', 'fungus_garden', 'tunnels'];
  const workshops = ['silk_weaving', 'chitin_armory', 'venom_lab', 'midden'];

  it('Colony lists Barracks, Walls and Warehouse; Combat adds the workshops', () => {
    gameState.value = makeState({ phase: Phase.COLONY });
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    for (const id of colonyOwn) expect(building(container, id), id).not.toBeNull();
    for (const id of workshops) expect(building(container, id), id).toBeNull();
    act(() => {
      gameState.value = makeState({ phase: Phase.COMBAT });
    });
    for (const id of [...colonyOwn, ...workshops]) expect(building(container, id), id).not.toBeNull();
  });

  it('BUY buys a Colony building in Colony through the action', () => {
    const cost = getBuildCost('walls', 1);
    let s = makeState({ phase: Phase.COLONY, resources: { ...broke, stone: cost.stone } });
    gameState.value = s;
    const actions = testActions(undefined, () => s, (n) => { s = n; gameState.value = n; });
    const { container } = render(<BuildingCards buy={(id) => actions.buyBuilding(id)} />);
    act(() => building(container, 'walls')!.querySelector('button')!.click());
    expect(gameState.value.buildings.walls.level).toBeGreaterThan(0);
  });

  it('a level whose price needs a resource nothing makes yet shows a disabled BUY, even with the stock', () => {
    // Find the first level of a colony building whose price names a combat resource (the Lv.5+ surcharge).
    const level = Array.from({ length: 20 }, (_, i) => i).find((l) => {
      const c = getBuildCost('walls', l + 1);
      return c.silk + c.chitin + c.venom > 0;
    })!;
    const lots = 1e12;
    gameState.value = makeState({
      phase: Phase.COLONY,
      resources: { food: lots, wood: lots, stone: lots, nectar: lots },
      combatResources: { chitin: lots, silk: lots, venom: lots },
      buildings: { walls: { level } },
    });
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    const btn = building(container, 'walls')!.querySelector('button')!;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    act(() => {
      gameState.value = { ...gameState.value, phase: Phase.COMBAT };
    });
    expect(btn.getAttribute('aria-disabled')).toBeNull();
  });

  it("the Colony's nectar buildings name what their next level adds (Story 4.7)", () => {
    gameState.value = makeState({ phase: Phase.COLONY });
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    expect(visibleText(building(container, 'fungus_garden')!.querySelector('.card__effect')!)).toMatch(/GATHER/);
    expect(visibleText(building(container, 'tunnels')!.querySelector('.card__effect')!)).toMatch(/DIG/);
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
    for (const p of getProjectsFor('research_panel')) {
      const el = research(container, p.id)!;
      expect(el, p.id).not.toBeNull();
      expect(el.getAttribute('data-research-status'), p.id).toBe(p.prerequisite ? 'locked' : 'available');
      expect(el.querySelector('.card__level')!.textContent, p.id).toMatch(/STEP \d\/\d/);
    }
    // The offline research has its own panel (Story 2.8).
    expect(research(container, OFFLINE_RESEARCH_ID)).toBeNull();
  });

  it('the offline research panel draws its one card in Colony, with no crew and no step (Story 2.8)', () => {
    gameState.value = makeState({ phase: Phase.COLONY, resources: { workers: 5, food: 100_000 } });
    const started: string[] = [];
    const { container } = render(
      <ResearchCards
        panel="offline_research_panel"
        start={(id) => (started.push(id), { ok: true })}
        cancel={() => ({ ok: true })}
        confirmSettings={confirmSettings()}
      />,
    );
    const cards = container.querySelectorAll('[data-research-project]');
    expect(cards).toHaveLength(1);
    const el = research(container, OFFLINE_RESEARCH_ID)!;
    expect(el.getAttribute('data-research-status')).toBe('available');
    expect(el.querySelector('.card__level')).toBeNull();
    expect(el.textContent).not.toMatch(/RESEARCHERS/);
    const btn = el.querySelector<HTMLButtonElement>('[data-action="start-research"]')!;
    expect(btn.getAttribute('aria-disabled')).not.toBe('true');
    btn.click();
    expect(started).toEqual([OFFLINE_RESEARCH_ID]);
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

  it('while running, CANCEL (<share> % BACK) shows the refund before confirming, and holding it refunds that share', () => {
    const share = researchBalance.cancelRefundShare;
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
    expect(cancel.getAttribute('aria-label')).toContain(`CANCEL (${formatFull(Math.floor(share * 100))} % BACK)`);
    const refund = research(container, vcs.id)!.querySelector('[data-refund]')!;
    for (const [res, amount] of Object.entries(vcs.cost)) {
      if (Math.floor((amount as number) * share) > 0) expect(refund.textContent).toContain(formatFull(Math.floor((amount as number) * share)));
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
      expect(gameState.value.resources[key]).toBe((before[key] as number) + Math.floor((amount as number) * share));
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

describe('Particle Lab card (Story 3.6)', () => {
  const lab = (root: ParentNode) => root.querySelector<HTMLElement>('[data-particle-lab]');
  const buy = (root: ParentNode) => lab(root)!.querySelector<HTMLButtonElement>('[data-action="build-particle-lab"]')!;

  it('shows the level change, the price and the shortfall while unaffordable', () => {
    gameState.value = makeState({ phase: Phase.SPACE, resources: broke });
    const { container } = render(<ParticleLabCard build={() => ({ ok: true })} />);
    const el = lab(container)!;
    expect(el).not.toBeNull();
    expect(visibleText(el.querySelector('.card__level')!)).toMatch(/LV\.0 → 1/);
    expect(el.querySelector('.card__cost')!.textContent).not.toBe('');
    expect(buy(container).getAttribute('aria-disabled')).toBe('true');
  });

  it('BUILD goes through the action: the lab gains a level and the price is paid', () => {
    const cost = getParticleLabCost(0);
    gameState.value = makeState({ phase: Phase.SPACE, resources: { stone: cost.stone, voidCrystals: cost.voidCrystals } });
    const actions = testActions();
    const { container } = render(<ParticleLabCard build={() => actions.buildParticleLab()} />);
    expect(buy(container).getAttribute('aria-disabled')).not.toBe('true');
    const before = gameState.value;
    act(() => buy(container).click());
    expect(gameState.value.conversions.particleLab).toBeGreaterThan(before.conversions.particleLab);
    expect(gameState.value.resources.stone).toBeLessThan(before.resources.stone);
    expect(visibleText(lab(container)!.querySelector('.card__level')!)).toMatch(/LV\.1 → 2/);
  });
});

describe('Workshops and the Midden (Story 4.8)', () => {
  it('a built workshop shows MAX and BUILT, and its BUY stays disabled even with plenty', () => {
    const lots = 1e9;
    gameState.value = makeState({
      phase: Phase.COMBAT,
      resources: { food: lots, wood: lots, stone: lots, nectar: lots },
      combatResources: { chitin: lots, silk: lots, venom: lots },
      buildings: { chitin_armory: { level: 1 }, silk_weaving: { level: 1 } },
    });
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    for (const id of ['chitin_armory', 'silk_weaving']) {
      const el = building(container, id)!;
      expect(visibleText(el.querySelector('.card__level')!), id).toMatch(/MAX/);
      expect(el.querySelector('.card__cost')!.textContent, id).toMatch(/BUILT/);
      expect(el.querySelector('button')!.getAttribute('aria-disabled'), id).toBe('true');
    }
    // The Midden has no last level: it stays on sale.
    expect(building(container, 'midden')!.querySelector('button')!.getAttribute('aria-disabled')).not.toBe('true');
  });

  it("the Midden's effect line says what each fallen soldier leaves", () => {
    gameState.value = makeState({ phase: Phase.COMBAT });
    const { container } = render(<BuildingCards buy={() => ({ ok: true })} />);
    expect(building(container, 'midden')!.querySelector('.card__effect')!.textContent).toMatch(/CHITIN PER FALLEN SOLDIER/);
  });
});
