import type { EventBus } from '../../engine/EventBus';

interface LogEntry {
  message: string;
  timestamp: number;
}

const MAX_ENTRIES = 100;

/**
 * Scrolling activity log. Listens for game events and shows narrative messages.
 * Newest entry at top, max 100 entries.
 */
export class EventLog {
  private container: HTMLDivElement;
  private entries: LogEntry[] = [];
  private logEl: HTMLDivElement;
  private firstClickFired = false;
  private firstWorkerFired = false;
  private tenthWorkerFired = false;
  private firstSoldierFired = false;
  private firstWeaponFired = false;
  private firstArmorFired = false;

  constructor(private bus: EventBus) {
    this.container = document.createElement('div');
    this.container.className = 'panel event-log';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Activity Log';
    this.container.appendChild(title);

    this.logEl = document.createElement('div');
    this.logEl.className = 'event-log-entries';
    this.container.appendChild(this.logEl);

    // Initial message
    this.addEntry('You are an ant queen. Your purpose is clear.');

    // Listen for events
    bus.subscribe('click:egg', () => this.onClick());
    bus.subscribe('workers_changed', () => this.onWorkersChanged());
    bus.subscribe('soldiers_changed', (payload: unknown) => {
      const p = payload as { soldiers: number };
      this.onSoldiersChanged(p.soldiers);
    });
    bus.subscribe('weapon_upgraded', (_payload: unknown) => {
      this.onWeaponUpgraded();
    });
    bus.subscribe('armor_upgraded', (_payload: unknown) => {
      this.onArmorUpgraded();
    });

    // Combat events
    bus.subscribe('enemy_scouted', (payload: unknown) => {
      const p = payload as { enemyType: string; enemyName: string };
      this.onEnemyScouted(p.enemyName);
    });
    bus.subscribe('battle_engage', (payload: unknown) => {
      const p = payload as { enemyType: string };
      this.onBattleEngage(p.enemyType);
    });
    bus.subscribe('battle_completed', (payload: unknown) => {
      const p = payload as { narrative: string };
      this.onBattleCompleted(p.narrative);
    });
    bus.subscribe('expedition_launch', (payload: unknown) => {
      const p = payload as { scouts: number; warriors: number; destination: string };
      this.onExpeditionLaunched(p);
    });
    bus.subscribe('expedition_return', (payload: unknown) => {
      this.onExpeditionReturn(payload as Record<string, unknown>);
    });
    bus.subscribe('building_complete', (payload: unknown) => {
      const p = payload as { building: string; level: number };
      this.onBuildingComplete(p);
    });
    bus.subscribe('soldier_recruited', (payload: unknown) => {
      const p = payload as { type: string; count: number };
      this.onSoldierRecruited(p);
    });
  }

  private addEntry(message: string): void {
    this.entries.unshift({ message, timestamp: Date.now() });
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.pop();
    }
    this.render();
  }

  private render(): void {
    // Clear and rebuild with textContent (avoids latent XSS vector)
    this.logEl.textContent = '';
    for (const entry of this.entries) {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.textContent = entry.message;
      this.logEl.appendChild(div);
    }
  }

  private onClick(): void {
    if (!this.firstClickFired) {
      this.firstClickFired = true;
      this.addEntry(
        'You lay your first egg. It is small, white, and perfect.',
      );
    }
  }

  private onWorkersChanged(): void {
    // We'll track worker milestones via the first/first + 10th checks
    // by reading state via the bus — but we don't have direct state access here.
    // Instead, track via the event payload if available.
    // For now, trigger on first worker event.
    if (!this.firstWorkerFired) {
      this.firstWorkerFired = true;
      this.addEntry(
        'The first worker emerges. She looks at you with absolute devotion.',
      );
    }
  }

  /**
   * Called externally when worker count changes, so we can check milestones.
   */
  notifyWorkerCount(count: number): void {
    if (!this.tenthWorkerFired && count >= 10) {
      this.tenthWorkerFired = true;
      this.addEntry(
        'The colony hums. You feel it through the soil.',
      );
    }
  }

  private onSoldiersChanged(count: number): void {
    if (!this.firstSoldierFired && count > 0) {
      this.firstSoldierFired = true;
      this.addEntry(
        'The first soldier ant emerges. Her mandibles gleam with purpose.',
      );
    }
  }

  private onWeaponUpgraded(): void {
    if (!this.firstWeaponFired) {
      this.firstWeaponFired = true;
      this.addEntry(
        "The soldiers' mandibles are honed sharper. Nature's design, perfected.",
      );
    }
  }

  private onArmorUpgraded(): void {
    if (!this.firstArmorFired) {
      this.firstArmorFired = true;
      this.addEntry(
        'Chitin plates are strapped to soldier thoraxes. The colony armors itself.',
      );
    }
  }

  private onEnemyScouted(enemyName: string): void {
    this.addEntry(`Scouts report a ${enemyName} in the territory.`);
  }

  private onBattleEngage(enemyType: string): void {
    this.addEntry(`The soldiers march to meet the ${enemyType}.`);
  }

  private onBattleCompleted(narrative: string): void {
    this.addEntry(narrative);
  }

  private onExpeditionLaunched(p: { scouts: number; warriors: number; destination: string }): void {
    const party = [];
    if (p.scouts > 0) party.push(`${p.scouts} scout${p.scouts > 1 ? 's' : ''}`);
    if (p.warriors > 0) party.push(`${p.warriors} warrior${p.warriors > 1 ? 's' : ''}`);
    const partyStr = party.join(' and ');
    this.addEntry(
      `An expedition departs for ${p.destination} — ${partyStr} march into the unknown.`,
    );
  }

  private onExpeditionReturn(payload: Record<string, unknown>): void {
    const dest = payload.destination as string;
    const result = payload.result as string;
    const scouts = payload.scoutsReturned as number;
    const warriors = payload.warriorsReturned as number;
    const food = payload.food as number;
    const stone = payload.stone as number;
    const nectar = payload.nectar as number;
    const wood = payload.wood as number;
    const tiles = payload.tilesDiscovered as number;

    const returned = [];
    if (scouts > 0) returned.push(`${scouts} scout${scouts > 1 ? 's' : ''}`);
    if (warriors > 0) returned.push(`${warriors} warrior${warriors > 1 ? 's' : ''}`);
    const returnedStr = returned.length > 0 ? returned.join(' and ') : 'None';

    const loot: string[] = [];
    if (food > 0) loot.push(`${food} food`);
    if (stone > 0) loot.push(`${stone} stone`);
    if (nectar > 0) loot.push(`${nectar} nectar`);
    if (wood > 0) loot.push(`${wood} wood`);
    const lootStr = loot.length > 0 ? loot.join(', ') : 'nothing';

    if (result === 'success') {
      this.addEntry(
        `Expedition returns triumphant from ${dest}! ${returnedStr} came back with ${lootStr}. ${tiles > 0 ? `${tiles} new tile${tiles > 1 ? 's' : ''} discovered.` : ''}`,
      );
    } else if (result === 'partial') {
      this.addEntry(
        `Expedition returns from ${dest} — battered but alive. ${returnedStr} made it back. Loot: ${lootStr}.`,
      );
    } else {
      this.addEntry(
        `The expedition to ${dest} has been lost. No one returned. The colony mourns.`,
      );
    }
  }

  private onBuildingComplete(p: { building: string; level: number }): void {
    const label = p.building.charAt(0).toUpperCase() + p.building.slice(1);
    this.addEntry(`${label} upgraded to level ${p.level}. The colony grows stronger.`);
  }

  private onSoldierRecruited(p: { type: string; count: number }): void {
    const label = p.type.charAt(0).toUpperCase() + p.type.slice(1);
    this.addEntry(
      `${p.count} ${label}${p.count > 1 ? 's' : ''} ${p.count > 1 ? 'have been' : 'has been'} recruited to the swarm.`,
    );
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
