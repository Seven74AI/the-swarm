import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import {
  MUTATIONS,
  purchaseMutation,
  canPurchaseMutation,
  isMutationUnlocked,
  type MutationDef,
  type MutationCost,
} from '../../systems/MutationSystem';

/**
 * MutationPanel — lets the player purchase colony mutations.
 * Grid layout showing mutation name, cost icons, effect description.
 * Visibility controlled by PhaseContent — shown when COMBAT phase is active.
 */
export class MutationPanel {
  private container: HTMLDivElement;
  private buyButtons: Map<string, HTMLButtonElement> = new Map();
  private statusSpans: Map<string, HTMLSpanElement> = new Map();
  private prereqDivs: Map<string, HTMLDivElement> = new Map();
  private cards: Map<string, HTMLDivElement> = new Map();
  private lastHash: string = '';

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'mutation-panel';
    this.container.className = 'panel mutation-panel';
    this.container.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '\uD83E\uDDEC Colony Mutations';
    this.container.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'panel-subtitle';
    subtitle.textContent = 'Permanent bonuses purchased with combat resources';
    this.container.appendChild(subtitle);

    const grid = document.createElement('div');
    grid.className = 'mutation-grid';
    grid.id = 'mutation-grid';
    this.container.appendChild(grid);

    for (const def of MUTATIONS) {
      const card = this.buildCard(def);
      grid.appendChild(card);
      this.cards.set(def.id, card);
    }

    effect(() => {
      const s = gameState.value;
      void s.mutations;
      void s.combatResources;
      this.refresh();
    });

    this.refresh();
  }

  private buildCard(def: MutationDef): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'mutation-card';
    card.id = `mutation-card-${def.id}`;

    // Name
    const name = document.createElement('div');
    name.className = 'mutation-name';
    name.textContent = def.name;
    card.appendChild(name);

    // Description
    const desc = document.createElement('div');
    desc.className = 'mutation-desc';
    desc.textContent = def.description;
    card.appendChild(desc);

    // Cost row
    const costRow = document.createElement('div');
    costRow.className = 'mutation-cost';
    const costIcons = this.buildCostIcons(def.cost);
    for (const icon of costIcons) {
      costRow.appendChild(icon);
    }
    card.appendChild(costRow);

    // Prerequisite info (hidden initially)
    const prereqDiv = document.createElement('div');
    prereqDiv.className = 'mutation-prereq';
    prereqDiv.style.display = 'none';
    if (def.prerequisite) {
      const prereqDef = MUTATIONS.find((m) => m.id === def.prerequisite);
      prereqDiv.textContent = `Requires: ${prereqDef?.name ?? def.prerequisite}`;
    }
    card.appendChild(prereqDiv);
    this.prereqDivs.set(def.id, prereqDiv);

    // Status span
    const status = document.createElement('span');
    status.className = 'mutation-status';
    card.appendChild(status);
    this.statusSpans.set(def.id, status);

    // Buy button
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn btn-sm mutation-buy-btn';
    buyBtn.style.display = 'none';
    buyBtn.addEventListener('click', () => {
      const currentState = this.getState();
      const updated = purchaseMutation(currentState, def.id);
      if (updated !== currentState) {
        this.setState(updated);
        this.bus.emit('mutation_purchased', { mutationId: def.id, name: def.name });
      }
    });
    card.appendChild(buyBtn);
    this.buyButtons.set(def.id, buyBtn);

    return card;
  }

  private buildCostIcons(cost: MutationCost): HTMLSpanElement[] {
    const icons: HTMLSpanElement[] = [];
    if (cost.chitin > 0) {
      const el = document.createElement('span');
      el.className = 'mutation-cost-icon';
      el.textContent = `\uD83E\uDD92 ${cost.chitin}`;
      icons.push(el);
    }
    if (cost.silk > 0) {
      const el = document.createElement('span');
      el.className = 'mutation-cost-icon';
      el.textContent = `\uD83E\uDDF5 ${cost.silk}`;
      icons.push(el);
    }
    if (cost.venom > 0) {
      const el = document.createElement('span');
      el.className = 'mutation-cost-icon';
      el.textContent = `\uD83E\uDDEA ${cost.venom}`;
      icons.push(el);
    }
    return icons;
  }

  private refresh(): void {
    const state = this.getState();
    const cr = state.combatResources;

    // Build hash for dirty-check
    const parts: string[] = [];
    for (const def of MUTATIONS) {
      const purchased = state.mutations.find((m) => m.id === def.id)?.purchased ?? false;
      const unlocked = isMutationUnlocked(state, def.id);
      const canBuy = canPurchaseMutation(state, def.id);
      parts.push(`${def.id}:p${purchased}:u${unlocked}:b${canBuy}`);
    }
    parts.push(`r:${cr.chitin}:${cr.silk}:${cr.venom}`);
    const hash = parts.join('|');
    if (hash === this.lastHash) return;
    this.lastHash = hash;

    for (const def of MUTATIONS) {
      const card = this.cards.get(def.id);
      if (!card) continue;

      const purchased = state.mutations.find((m) => m.id === def.id)?.purchased ?? false;
      const unlocked = isMutationUnlocked(state, def.id);
      const canBuy = canPurchaseMutation(state, def.id);

      const statusEl = this.statusSpans.get(def.id);
      const buyBtn = this.buyButtons.get(def.id);
      const prereqEl = this.prereqDivs.get(def.id);
      if (!statusEl || !buyBtn) continue;

      // Reset display
      statusEl.style.display = 'none';
      buyBtn.style.display = 'none';
      if (prereqEl) prereqEl.style.display = 'none';

      // Reset card class
      card.className = 'mutation-card';

      if (purchased) {
        card.classList.add('mutation-purchased');
        statusEl.style.display = '';
        statusEl.textContent = 'Acquired \u2713';
        statusEl.className = 'mutation-status mutation-acquired';
      } else if (!unlocked) {
        card.classList.add('mutation-locked');
        if (prereqEl && def.prerequisite) {
          prereqEl.style.display = '';
        }
        statusEl.style.display = '';
        statusEl.textContent = 'Locked';
        statusEl.className = 'mutation-status mutation-locked-status';
      } else {
        // Available — show buy button
        buyBtn.style.display = '';
        if (canBuy) {
          buyBtn.textContent = 'Buy';
          buyBtn.className = 'btn btn-sm btn-primary mutation-buy-btn';
          buyBtn.disabled = false;
        } else {
          const missing = this.formatMissingResources(def.cost, cr);
          buyBtn.textContent = `Need: ${missing}`;
          buyBtn.className = 'btn btn-sm mutation-buy-btn';
          buyBtn.disabled = true;
        }
      }
    }
  }

  private formatMissingResources(cost: MutationCost, cr: { chitin: number; silk: number; venom: number }): string {
    const parts: string[] = [];
    if (cost.chitin > 0 && cr.chitin < cost.chitin) {
      parts.push(`\uD83E\uDD92 ${cost.chitin - cr.chitin}`);
    }
    if (cost.silk > 0 && cr.silk < cost.silk) {
      parts.push(`\uD83E\uDDF5 ${cost.silk - cr.silk}`);
    }
    if (cost.venom > 0 && cr.venom < cost.venom) {
      parts.push(`\uD83E\uDDEA ${cost.venom - cr.venom}`);
    }
    return parts.join(' ') || '';
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
