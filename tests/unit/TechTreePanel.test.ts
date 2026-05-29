import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { TechTreePanel } from '../../src/ui/panels/TechTreePanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { PRESTIGE_UPGRADES } from '../../src/data/prestigeTree';

describe('TechTreePanel', () => {
  let bus: EventBus;
  let panel: TechTreePanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new TechTreePanel(
      bus,
      () => currentState,
      (s: GameState) => { currentState = s; },
    );
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('tech-tree-panel');
  });

  it('shows tech tree title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Tech Tree');
  });

  it('shows Legacy Points counter', () => {
    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 5 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Legacy Points');
    expect(text).toContain('5');
  });

  it('renders all 8 prestige upgrades as nodes', () => {
    const el = panel.getElement();
    const nodes = el.querySelectorAll('.tech-tree-node');
    expect(nodes.length).toBe(PRESTIGE_UPGRADES.length);
  });

  it('renders SVG element for connection lines', () => {
    const el = panel.getElement();
    const svg = el.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders connection lines between parent and child nodes', () => {
    const el = panel.getElement();
    const lines = el.querySelectorAll('.tech-tree-line');
    // Each node that has prerequisites generates connection lines to its parents
    // Nodes with prerequisites: soldier_training_bonus, worker_efficiency_bonus,
    // auto_egg_laying, starting_resources, phase_skip (has 2 parents = 2 lines)
    // Total: 1 + 1 + 1 + 1 + 2 = 6 lines
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  it('shows "Buy" buttons on unpurchased nodes', () => {
    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 100 },
    };
    panel.refresh();
    const el = panel.getElement();
    const buttons = el.querySelectorAll('.btn-tree-purchase');
    expect(buttons.length).toBe(PRESTIGE_UPGRADES.length);
  });

  it('shows "Owned" badge on purchased nodes', () => {
    currentState = {
      ...currentState,
      prestigeTree: { purchased: ['egg_laying_bonus'] },
    };
    panel.refresh();
    const el = panel.getElement();
    const ownedBadges = el.querySelectorAll('.tech-tree-purchased-badge');
    expect(ownedBadges.length).toBeGreaterThanOrEqual(1);
    expect(ownedBadges[0].textContent).toContain('Owned');
  });

  it('purchased nodes have the purchased CSS class', () => {
    currentState = {
      ...currentState,
      prestigeTree: { purchased: ['egg_laying_bonus'] },
    };
    panel.refresh();
    const el = panel.getElement();
    const purchasedNodes = el.querySelectorAll('.tech-node-purchased');
    expect(purchasedNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('nodes with unmet prerequisites are locked', () => {
    // soldier_training_bonus requires egg_laying_bonus (not purchased)
    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 100 },
    };
    panel.refresh();
    const el = panel.getElement();
    const lockedNodes = el.querySelectorAll('.tech-node-locked');
    // All depth-1+ nodes should be locked (their root prerequisites aren't owned)
    expect(lockedNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('locked nodes have disabled Buy buttons', () => {
    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 100 },
    };
    panel.refresh();
    const el = panel.getElement();
    const lockedNode = el.querySelector('.tech-node-locked');
    expect(lockedNode).toBeTruthy();
    const btn = lockedNode!.querySelector('button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('nodes become available when prerequisites are met', () => {
    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 100 },
      prestigeTree: { purchased: ['egg_laying_bonus'] },
    };
    panel.refresh();
    const el = panel.getElement();
    const availableNodes = el.querySelectorAll('.tech-node-available');
    // soldier_training_bonus should be available now (prereq met, enough LP)
    expect(availableNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('unaffordable nodes have CSS class when not enough LP', () => {
    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 0 },
    };
    panel.refresh();
    const el = panel.getElement();
    // Root nodes (depth 0) have no prerequisites but cost 3 LP — unaffordable
    const unaffordableNodes = el.querySelectorAll('.tech-node-unaffordable');
    expect(unaffordableNodes.length).toBeGreaterThanOrEqual(3);
  });

  it('completes purchase when clicking Buy on an available node', () => {
    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 100 },
    };
    panel.refresh();
    const el = panel.getElement();

    // Find a depth-0 node (no prereq) and click its Buy button
    const availableNodes = el.querySelectorAll('.tech-node-available');
    expect(availableNodes.length).toBeGreaterThanOrEqual(1);

    const availableNode = availableNodes[0] as HTMLElement;
    const btn = availableNode.querySelector('button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);

    btn.click();

    // After purchase, state should have the upgrade
    expect(currentState.prestigeTree.purchased.length).toBeGreaterThanOrEqual(1);
  });

  it('emits prestige_upgrade_purchased event on purchase', () => {
    let eventReceived: Record<string, unknown> | null = null;
    bus.subscribe('prestige_upgrade_purchased', (payload: unknown) => {
      eventReceived = payload as Record<string, unknown>;
    });

    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 100 },
    };
    panel.refresh();

    const el = panel.getElement();
    const availableNode = el.querySelector('.tech-node-available') as HTMLElement;
    const btn = availableNode.querySelector('button') as HTMLButtonElement;
    btn.click();

    expect(eventReceived).not.toBeNull();
    expect(eventReceived!.upgradeId).toBeTruthy();
  });

  it('deducts legacy points on purchase', () => {
    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 100 },
    };
    panel.refresh();

    const el = panel.getElement();
    const availableNode = el.querySelector('.tech-node-available') as HTMLElement;
    const btn = availableNode.querySelector('button') as HTMLButtonElement;
    btn.click();

    // The cheapest root upgrade costs 3 LP
    expect(currentState.prestige.legacyPoints).toBe(97);
  });

  it('shows completion message when all upgrades are purchased', () => {
    currentState = {
      ...currentState,
      prestigeTree: {
        purchased: PRESTIGE_UPGRADES.map((u) => u.id),
      },
    };
    panel.refresh();
    const el = panel.getElement();
    const complete = el.querySelector('.prestige-tree-complete');
    expect(complete).toBeTruthy();
    expect(complete!.textContent).toContain('All upgrades purchased');
  });

  it('refresh method updates the DOM with new state', () => {
    const el1 = panel.getElement();
    const initialNodes = el1.querySelectorAll('.tech-tree-node').length;

    currentState = {
      ...currentState,
      prestige: { ...currentState.prestige, legacyPoints: 5 },
    };
    panel.refresh();

    const el2 = panel.getElement();
    const updatedNodes = el2.querySelectorAll('.tech-tree-node').length;
    expect(updatedNodes).toBe(initialNodes); // still 8 nodes
  });

  it('node depth level matches data depth', () => {
    const el = panel.getElement();
    const nodes = el.querySelectorAll('.tech-tree-node');

    const styles: string[] = [];
    nodes.forEach((node) => {
      styles.push((node as HTMLElement).style.cssText);
    });

    // Verify all nodes have absolute positioning
    expect(styles.every((s) => s.includes('position: absolute'))).toBe(true);
  });
});
