import type { EventBus } from '../../engine/EventBus';

interface LogEntry {
  message: string;
  timestamp: number;
}

const MAX_ENTRIES = 100;

/**
 * Scrolling activity log. Listens for game events and shows milestone-based narrative messages.
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
  private firstBuildingFired = false;
  private colonyUnlockedFired = false;
  private combatUnlockedFired = false;
  private expansionUnlockedFired = false;
  private spaceUnlockedFired = false;

  /** Stored callback references for unsubscribe. */
  private unsubscribeHandles: Array<() => void> = [];

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

    // Listen for events (milestone-based, no spam)
    const onClickCb = () => this.onClick();
    bus.subscribe('click:egg', onClickCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('click:egg', onClickCb));

    const onWorkersCb = () => this.onWorkersChanged();
    bus.subscribe('workers_changed', onWorkersCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('workers_changed', onWorkersCb));

    const onSoldiersCb = (payload: unknown) => {
      const p = payload as { soldiers: number };
      if (p.soldiers > 0) this.onSoldiersChanged(p.soldiers);
    };
    bus.subscribe('soldiers_changed', onSoldiersCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('soldiers_changed', onSoldiersCb));

    const onWeaponCb = () => this.onWeaponUpgraded();
    bus.subscribe('weapon_upgraded', onWeaponCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('weapon_upgraded', onWeaponCb));

    const onArmorCb = () => this.onArmorUpgraded();
    bus.subscribe('armor_upgraded', onArmorCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('armor_upgraded', onArmorCb));

    const onScoutCb = (payload: unknown) => {
      const p = payload as { enemyType: string; enemyName: string };
      this.addEntry(`Scouts report a ${p.enemyName} in the territory.`);
    };
    bus.subscribe('enemy_scouted', onScoutCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('enemy_scouted', onScoutCb));

    const onEngageCb = (payload: unknown) => {
      const p = payload as { enemyType: string };
      this.addEntry(`The soldiers march to meet the ${p.enemyType}.`);
    };
    bus.subscribe('battle_engage', onEngageCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('battle_engage', onEngageCb));

    const onBattleDoneCb = (payload: unknown) => {
      const p = payload as { narrative: string };
      this.addEntry(p.narrative || 'The battle is over.');
    };
    bus.subscribe('battle_completed', onBattleDoneCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('battle_completed', onBattleDoneCb));

    const onExpeditionLaunchCb = (payload: unknown) => {
      const p = payload as { scouts: number; warriors: number; destination: string };
      const party = [];
      if (p.scouts > 0) party.push(`${p.scouts} scout${p.scouts > 1 ? 's' : ''}`);
      if (p.warriors > 0) party.push(`${p.warriors} warrior${p.warriors > 1 ? 's' : ''}`);
      this.addEntry(`An expedition departs for ${p.destination} — ${party.join(' and ')} march into the unknown.`);
    };
    bus.subscribe('expedition_launch', onExpeditionLaunchCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('expedition_launch', onExpeditionLaunchCb));

    const onExpeditionReturnCb = (payload: unknown) => {
      const p = payload as Record<string, unknown>;
      const dest = p.destination as string;
      const result = p.result as string;
      const scouts = p.scoutsReturned as number;
      const warriors = p.warriorsReturned as number;
      const food = p.food as number;
      const stone = p.stone as number;
      const nectar = p.nectar as number;
      const wood = p.wood as number;
      const tiles = p.tilesDiscovered as number;

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
        this.addEntry(`Expedition returns triumphant from ${dest}! ${returnedStr} came back with ${lootStr}.`);
      } else if (result === 'partial') {
        this.addEntry(`Expedition returns from ${dest} — battered but alive. ${returnedStr} made it back. Loot: ${lootStr}.`);
      } else {
        this.addEntry(`The expedition to ${dest} has been lost. No one returned. The colony mourns.`);
      }
    };
    bus.subscribe('expedition_return', onExpeditionReturnCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('expedition_return', onExpeditionReturnCb));

    const onBuildingCb = (payload: unknown) => {
      const p = payload as { building: string; level: number };
      const label = p.building.charAt(0).toUpperCase() + p.building.slice(1);
      this.addEntry(`${label} upgraded to level ${p.level}. The colony grows stronger.`);
    };
    bus.subscribe('building_complete', onBuildingCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('building_complete', onBuildingCb));

    const onRecruitCb = (payload: unknown) => {
      const p = payload as { type: string; count: number };
      if (p.count > 0) {
        this.addEntry(`${p.count} soldier${p.count > 1 ? 's' : ''} completed training and joined the swarm.`);
      }
    };
    bus.subscribe('soldier_recruited', onRecruitCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('soldier_recruited', onRecruitCb));

    const onPhaseCb = (payload: unknown) => {
      const p = payload as { phase: string };
      this.onPhaseChanged(p.phase);
    };
    bus.subscribe('phase_changed', onPhaseCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('phase_changed', onPhaseCb));

    const onPanelCb = (payload: unknown) => {
      const p = payload as { panelId: string };
      this.onPanelRevealed(p.panelId);
    };
    bus.subscribe('panel_revealed', onPanelCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('panel_revealed', onPanelCb));
  }

  /** Unsubscribe from all events. Call before discarding this EventLog. */
  destroy(): void {
    for (const unsub of this.unsubscribeHandles) {
      unsub();
    }
    this.unsubscribeHandles = [];
  }

  private addEntry(message: string): void {
    this.entries.unshift({ message, timestamp: Date.now() });
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.pop();
    }
    this.render();
  }

  private render(): void {
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
      this.addEntry('You lay your first egg. It is small, white, and perfect.');
    }
  }

  private onWorkersChanged(): void {
    if (!this.firstWorkerFired) {
      this.firstWorkerFired = true;
      this.addEntry('The first worker emerges. She looks at you with absolute devotion.');
    }
  }

  notifyWorkerCount(count: number): void {
    if (!this.tenthWorkerFired && count >= 10) {
      this.tenthWorkerFired = true;
      this.addEntry('The colony hums. You feel it through the soil.');
    }
  }

  private onSoldiersChanged(count: number): void {
    if (!this.firstSoldierFired && count > 0) {
      this.firstSoldierFired = true;
      this.addEntry('The first soldier ant emerges. Her mandibles gleam with purpose.');
    }
  }

  private onWeaponUpgraded(): void {
    if (!this.firstWeaponFired) {
      this.firstWeaponFired = true;
      this.addEntry("The soldiers' mandibles are honed sharper. Nature's design, perfected.");
    }
  }

  private onArmorUpgraded(): void {
    if (!this.firstArmorFired) {
      this.firstArmorFired = true;
      this.addEntry('Chitin plates are strapped to soldier thoraxes. The colony armors itself.');
    }
  }

  private onPhaseChanged(phase: string): void {
    if (phase === 'colony' && !this.colonyUnlockedFired) {
      this.colonyUnlockedFired = true;
      this.addEntry('The colony takes shape. Worker ants now serve a purpose — assign them.');
    }
    if (phase === 'combat' && !this.combatUnlockedFired) {
      this.combatUnlockedFired = true;
      this.addEntry('⚔️ Danger lurks beyond the nest. Train soldiers, forge weapons, defend the colony.');
    }
    if (phase === 'expansion' && !this.expansionUnlockedFired) {
      this.expansionUnlockedFired = true;
      this.addEntry('🗺️ The world beyond the nest calls. Build, explore, expand your territory.');
    }
    if (phase === 'space' && !this.spaceUnlockedFired) {
      this.spaceUnlockedFired = true;
      this.addEntry('🚀 The swarm looks to the stars. New resources await in the void.');
    }
  }

  private onPanelRevealed(panelId: string): void {
    if (panelId === 'soldier_panel') {
      this.addEntry('⚔️ Soldier Command is now available — recruit and equip your army.');
    } else if (panelId === 'building_panel' && !this.firstBuildingFired) {
      this.firstBuildingFired = true;
      this.addEntry('🏗️ Construction unlocked — buildings strengthen the colony.');
    } else if (panelId === 'expedition_panel') {
      this.addEntry('🗺️ Expeditions are now available — send scouts to gather resources.');
    } else if (panelId === 'spaceship_panel') {
      this.addEntry('🚀 Spaceship construction unlocked — build your vessel to the stars.');
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
