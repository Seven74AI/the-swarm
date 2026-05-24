import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { PRESTIGE_UPGRADES, type PrestigeUpgrade } from '../../data/prestigeTree';
import {
  canPurchasePrestigeUpgrade,
  purchasePrestigeUpgrade,
  isPrestigeUpgradePurchased,
} from '../../systems/PrestigeSystem';

/**
 * PrestigeTreePanel — permanent upgrade card-grid UI.
 *
 * Shows 8 prestige tree upgrades as cards:
 *   - Card content: icon, name, description, cost
 *   - Visual states: available (colored), unaffordable (grey), purchased (green check)
 *   - Purchase button for available upgrades
 *
 * Uses the @preact/signals-core effect() pattern for reactivity,
 * matching ExpeditionPanel/ExplorationPanel.
 */
export class PrestigeTreePanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'prestige-tree-panel';
    this.container.className = 'panel prestige-tree-panel';
    // Hidden by default — revealed via showPanel() on phase enter

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
    const purchased = state.prestigeTree.purchased;

    // ── Title ──
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🌳 Prestige Tree';
    this.container.appendChild(title);

    // ── Legacy Points display ──
    const pointsRow = document.createElement('div');
    pointsRow.className = 'stat-row prestige-tree-points';
    const pointsLabel = document.createElement('span');
    pointsLabel.className = 'stat-label';
    pointsLabel.textContent = '🏆 Available Points';
    const pointsValue = document.createElement('span');
    pointsValue.className = 'stat-value';
    pointsValue.textContent = String(legPoints);
    pointsRow.appendChild(pointsLabel);
    pointsRow.appendChild(pointsValue);
    this.container.appendChild(pointsRow);

    // ── Upgrades card grid ──
    const grid = document.createElement('div');
    grid.className = 'prestige-tree-grid';

    for (const upgrade of PRESTIGE_UPGRADES) {
      const card = this.createUpgradeCard(upgrade, state);
      grid.appendChild(card);
    }
    this.container.appendChild(grid);

    // ── Empty state when all purchased ──
    if (purchased.length >= PRESTIGE_UPGRADES.length) {
      const complete = document.createElement('div');
      complete.className = 'prestige-tree-complete';
      complete.textContent = '✨ All upgrades purchased. The swarm transcends all limits.';
      this.container.appendChild(complete);
    }
  }

  /**
   * Create a single upgrade card with appropriate visual state.
   */
  private createUpgradeCard(upgrade: PrestigeUpgrade, state: GameState): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'prestige-tree-card';

    const isPurchased = isPrestigeUpgradePurchased(state, upgrade.id);
    const canPurchase = canPurchasePrestigeUpgrade(state, upgrade.id);
    const insufficientPoints = !isPurchased && state.prestige.legacyPoints < upgrade.cost;

    // Visual state classes
    if (isPurchased) {
      card.classList.add('prestige-card-purchased');
    } else if (insufficientPoints) {
      card.classList.add('prestige-card-unaffordable');
    } else {
      card.classList.add('prestige-card-available');
    }

    // Icon
    const icon = document.createElement('div');
    icon.className = 'prestige-tree-card-icon';
    icon.textContent = upgrade.icon;
    card.appendChild(icon);

    // Name
    const name = document.createElement('div');
    name.className = 'prestige-tree-card-name';
    name.textContent = upgrade.name;
    card.appendChild(name);

    // Type badge
    const typeBadge = document.createElement('div');
    typeBadge.className = 'prestige-tree-card-type';
    typeBadge.textContent = upgrade.type === 'unlock' ? '🔓 Unlock' : '📈 Production';
    card.appendChild(typeBadge);

    // Description
    const desc = document.createElement('div');
    desc.className = 'prestige-tree-card-desc';
    desc.textContent = upgrade.description;
    card.appendChild(desc);

    // Cost or purchased status
    const footer = document.createElement('div');
    footer.className = 'prestige-tree-card-footer';

    if (isPurchased) {
      const purchasedBadge = document.createElement('span');
      purchasedBadge.className = 'prestige-tree-purchased-badge';
      purchasedBadge.textContent = '✅ Owned';
      footer.appendChild(purchasedBadge);
    } else {
      const costSpan = document.createElement('span');
      costSpan.className = 'prestige-tree-card-cost';
      costSpan.textContent = `🏆 ${upgrade.cost}`;
      footer.appendChild(costSpan);

      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-tree-purchase';
      btn.textContent = 'Purchase';
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
        btn.setAttribute('title', `Need ${upgrade.cost - state.prestige.legacyPoints} more Legacy Points`);
      } else {
        btn.setAttribute('title', 'Already purchased');
      }

      footer.appendChild(btn);
    }

    card.appendChild(footer);
    return card;
  }
}
