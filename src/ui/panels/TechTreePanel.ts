import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { PRESTIGE_UPGRADES, type PrestigeUpgrade, type PrestigeUpgradeId } from '../../data/prestigeTree';
import {
  canPurchasePrestigeUpgrade,
  purchasePrestigeUpgrade,
  isPrestigeUpgradePurchased,
} from '../../systems/PrestigeSystem';

/**
 * TechTreePanel — tree visualization of the prestige tree.
 *
 * Renders 8 prestige upgrades as a hierarchical tree with:
 *   - SVG-drawn connection lines between parent and child nodes
 *   - Nodes organized by depth (0 = root, 3 = ultimate unlock)
 *   - Visual states: purchased (green), available (gold), locked (grey)
 *   - Purchase buttons on available nodes
 *   - Legacy Points counter in the header
 *
 * Uses @preact/signals-core effect() for reactivity,
 * matching PrestigeTreePanel/ExpeditionPanel patterns.
 */

/** Layout constants */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 130;
const H_GAP = 40; // horizontal gap between sibling nodes
const V_GAP = 100; // vertical gap between depth levels
const PADDING = 30;

interface NodePosition {
  upgrade: PrestigeUpgrade;
  x: number;
  y: number;
  depth: number;
}

export class TechTreePanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'tech-tree-panel';
    this.container.className = 'panel tech-tree-panel';

    this.render();

    // Reactive: re-render when prestige data changes
    effect(() => {
      void gameState.value.prestige;
      void gameState.value.prestigeTree;
      this.render();
    });
  }

  /** Public refresh for tests and manual updates. */
  refresh(): void {
    this.render();
  }

  getElement(): HTMLDivElement {
    return this.container;
  }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();
    const legPoints = state.prestige.legacyPoints;
    const purchased = new Set(state.prestigeTree.purchased);

    // ── Title ──
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🌳 Tech Tree';
    this.container.appendChild(title);

    // ── Legacy Points display ──
    const pointsRow = document.createElement('div');
    pointsRow.className = 'stat-row tech-tree-points';
    const pointsLabel = document.createElement('span');
    pointsLabel.className = 'stat-label';
    pointsLabel.textContent = '🏆 Legacy Points';
    const pointsValue = document.createElement('span');
    pointsValue.className = 'stat-value';
    pointsValue.textContent = String(legPoints);
    pointsRow.appendChild(pointsLabel);
    pointsRow.appendChild(pointsValue);
    this.container.appendChild(pointsRow);

    // ── Compute tree layout ──
    const upgradesByDepth = this.groupByDepth();
    const layout = this.computeLayout(upgradesByDepth);

    if (layout.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'panel-placeholder';
      empty.textContent = 'No upgrades available.';
      this.container.appendChild(empty);
      return;
    }

    // ── SVG container for connection lines ──
    const totalWidth = this.computeTotalWidth(layout) + 2 * PADDING;
    const totalHeight = this.computeTotalHeight(upgradesByDepth);

    const svgWrapper = document.createElement('div');
    svgWrapper.className = 'tech-tree-svg-wrapper';
    svgWrapper.style.cssText = `position:relative; width:${totalWidth}px; height:${totalHeight}px;`;

    // Draw SVG lines
    const svg = this.createSVGLines(layout, totalWidth, totalHeight);
    svgWrapper.appendChild(svg);

    // ── Overlay HTML nodes on top of SVG ──
    const nodesLayer = document.createElement('div');
    nodesLayer.className = 'tech-tree-nodes-layer';
    nodesLayer.style.cssText = `position:absolute; top:0; left:0; width:${totalWidth}px; height:${totalHeight}px; pointer-events:none;`;

    for (const pos of layout) {
      const node = this.createUpgradeNode(pos, state, purchased);
      nodesLayer.appendChild(node);
    }

    svgWrapper.appendChild(nodesLayer);
    this.container.appendChild(svgWrapper);

    // ── Empty state when all purchased ──
    if (purchased.size >= PRESTIGE_UPGRADES.length) {
      const complete = document.createElement('div');
      complete.className = 'prestige-tree-complete';
      complete.textContent = '✨ All upgrades purchased. The swarm transcends all limits.';
      this.container.appendChild(complete);
    }
  }

  /**
   * Group upgrades by depth. Returns a map: depth → upgrades at that depth.
   */
  private groupByDepth(): Map<number, PrestigeUpgrade[]> {
    const map = new Map<number, PrestigeUpgrade[]>();
    for (const u of PRESTIGE_UPGRADES) {
      const list = map.get(u.depth) ?? [];
      list.push(u);
      map.set(u.depth, list);
    }
    return map;
  }

  /**
   * Compute the total width needed for the widest row.
   */
  private computeTotalWidth(layout: NodePosition[]): number {
    let maxX = 0;
    for (const pos of layout) {
      maxX = Math.max(maxX, pos.x + NODE_WIDTH);
    }
    return maxX;
  }

  /**
   * Compute total height needed.
   */
  private computeTotalHeight(byDepth: Map<number, PrestigeUpgrade[]>): number {
    const maxDepth = Math.max(...byDepth.keys());
    return (maxDepth + 1) * (NODE_HEIGHT + V_GAP) + V_GAP;
  }

  /**
   * Compute the (x, y) positions for each upgrade node.
   * Centers each row and distributes nodes evenly.
   */
  private computeLayout(
    byDepth: Map<number, PrestigeUpgrade[]>,
  ): NodePosition[] {
    const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b);
    const positions: NodePosition[] = [];

    // First, determine the widest row and its total width
    let widestCount = 0;
    let widestTotalWidth = 0;
    for (const depth of sortedDepths) {
      const upgrades = byDepth.get(depth)!;
      const count = upgrades.length;
      const rowWidth = count * NODE_WIDTH + (count - 1) * H_GAP;
      if (count > widestCount) {
        widestCount = count;
        widestTotalWidth = rowWidth;
      }
    }

    for (const depth of sortedDepths) {
      const upgrades = byDepth.get(depth)!;
      const count = upgrades.length;
      const rowWidth = count * NODE_WIDTH + (count - 1) * H_GAP;
      const startX = PADDING + (widestTotalWidth - rowWidth) / 2;
      const y = PADDING + depth * (NODE_HEIGHT + V_GAP);

      for (let i = 0; i < count; i++) {
        const x = startX + i * (NODE_WIDTH + H_GAP);
        positions.push({
          upgrade: upgrades[i],
          x,
          y,
          depth,
        });
      }
    }

    return positions;
  }

  /**
   * Create SVG element with lines connecting parent nodes to their children.
   */
  private createSVGLines(
    layout: NodePosition[],
    totalWidth: number,
    totalHeight: number,
  ): Element {
    const xmlns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(xmlns, 'svg') as unknown as SVGElement;
    svg.setAttribute('width', String(totalWidth));
    svg.setAttribute('height', String(totalHeight));
    svg.style.cssText = 'position:absolute; top:0; left:0;';

    // Draw lines from each parent to each of its children
    for (const parentPos of layout) {
      const children = layout.filter(
        (p) => p.upgrade.prerequisites.includes(parentPos.upgrade.id),
      );

      for (const childPos of children) {
        const line = this.createConnectionLine(
          xmlns,
          parentPos.x + NODE_WIDTH / 2,
          parentPos.y + NODE_HEIGHT,
          childPos.x + NODE_WIDTH / 2,
          childPos.y,
          parentPos.upgrade.id,
          childPos.upgrade.id,
        );
        svg.appendChild(line);
      }
    }

    return svg;
  }

  /**
   * Draw a single connection line between a parent bottom-center and
   * child top-center with a curved path.
   */
  private createConnectionLine(
    xmlns: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    parentId: string,
    childId: string,
  ): Element {
    const path = document.createElementNS(xmlns, 'path');

    // Curved bezier: control points offset vertically
    const midY = (y1 + y2) / 2;
    const d =
      `M ${x1} ${y1} ` +
      `C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    path.setAttribute('d', d);
    path.setAttribute('stroke', '#555');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('data-parent', parentId);
    path.setAttribute('data-child', childId);
    path.classList.add('tech-tree-line');

    return path;
  }

  /**
   * Create a single upgrade node card positioned absolutely.
   */
  private createUpgradeNode(
    pos: NodePosition,
    state: GameState,
    purchased: Set<string>,
  ): HTMLDivElement {
    const { upgrade, x, y } = pos;
    const isPurchased = purchased.has(upgrade.id);
    const canPurchase = canPurchasePrestigeUpgrade(state, upgrade.id);
    const anyPrereqMissing = upgrade.prerequisites.some(
      (p) => !purchased.has(p),
    );
    const insufficientPoints =
      !isPurchased && state.prestige.legacyPoints < upgrade.cost;

    const card = document.createElement('div');
    card.className = 'tech-tree-node';
    card.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:${NODE_WIDTH}px; min-height:${NODE_HEIGHT}px; pointer-events:auto;`;

    // Visual state class
    if (isPurchased) {
      card.classList.add('tech-node-purchased');
    } else if (anyPrereqMissing) {
      card.classList.add('tech-node-locked');
    } else if (insufficientPoints) {
      card.classList.add('tech-node-unaffordable');
    } else {
      card.classList.add('tech-node-available');
    }

    // Icon
    const icon = document.createElement('div');
    icon.className = 'tech-tree-node-icon';
    icon.textContent = upgrade.icon;
    card.appendChild(icon);

    // Name
    const name = document.createElement('div');
    name.className = 'tech-tree-node-name';
    name.textContent = upgrade.name;
    card.appendChild(name);

    // Type badge
    const typeBadge = document.createElement('div');
    typeBadge.className = 'tech-tree-node-type';
    typeBadge.textContent =
      upgrade.type === 'unlock' ? '🔓 Unlock' : '📈 Production';
    card.appendChild(typeBadge);

    // Description
    const desc = document.createElement('div');
    desc.className = 'tech-tree-node-desc';
    desc.textContent = upgrade.description;
    card.appendChild(desc);

    // Footer: cost or purchased status
    const footer = document.createElement('div');
    footer.className = 'tech-tree-node-footer';

    if (isPurchased) {
      const badge = document.createElement('span');
      badge.className = 'tech-tree-purchased-badge';
      badge.textContent = '✅ Owned';
      footer.appendChild(badge);
    } else {
      const costSpan = document.createElement('span');
      costSpan.className = 'tech-tree-node-cost';
      costSpan.textContent = `🏆 ${upgrade.cost}`;
      footer.appendChild(costSpan);

      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-tree-purchase';
      btn.textContent = 'Buy';
      btn.disabled = !canPurchase;

      if (canPurchase) {
        btn.addEventListener('click', () => {
          const result = purchasePrestigeUpgrade(this.getState(), upgrade.id);
          if (result) {
            this.bus.emit('prestige_upgrade_purchased', {
              upgradeId: upgrade.id,
              upgradeName: upgrade.name,
            });
            this.setState(result);
          }
        });
      } else if (insufficientPoints) {
        btn.setAttribute(
          'title',
          `Need ${upgrade.cost - state.prestige.legacyPoints} more Legacy Points`,
        );
      } else if (anyPrereqMissing) {
        const missingNames = upgrade.prerequisites
          .filter((p) => !purchased.has(p))
          .map((p) => PRESTIGE_UPGRADES.find((u) => u.id === p)?.name ?? p)
          .join(', ');
        btn.setAttribute('title', `Requires: ${missingNames}`);
      }

      footer.appendChild(btn);
    }

    card.appendChild(footer);
    return card;
  }
}
