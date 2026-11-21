import { effect } from '@preact/signals-core';
import { getDecision, timeoutLine, type DecisionId } from '../../data/content/decisions';
import type { EventBus } from '../../engine/EventBus';
import type { PanelId } from '../../data/content/tabs';
import { createChronicle, type Chronicle, type ChronicleEntry } from '../../state/chronicle';
import type { LineJump } from '../log/jump';

/** One event line (kept in the chronicle, Story 1.26). */
export type LogEntry = ChronicleEntry;

/** The first line of a new chronicle. */
export const OPENING_LINE = 'You are an ant queen. Your purpose is clear.';
/** The first line after a prestige (EXPERIENCE.md Flow 7). */
export const PRESTIGE_LINE = 'A queen, again. The colony begins anew.';

export interface EventLogOptions {
  /** Where the lines go (main passes the saved one); default: a new chronicle. */
  chronicle?: Chronicle;
  /** Tapping a line that points at something jumps to it (Story 1.26). */
  jump?: LineJump;
}

/** "Now available" lines, written once per run when a panel is first revealed. */
const PANEL_LINES: Readonly<Record<string, string>> = {
  soldier_panel: '⚔️ Soldier Command is now available — recruit and equip your army.',
  building_panel: '🏗️ Construction unlocked — buildings strengthen the colony.',
  expedition_panel: '🗺️ Expeditions are now available — send scouts to gather resources.',
  spaceship_panel: '🚀 Spaceship construction unlocked — build your vessel to the stars.',
};

/** NEST shows this many newest lines; CSS keeps only the newest below 560 px viewport height (UX-DR30). */
export const NEST_LINES = 3;

/**
 * The colony's event lines. Listens for game events and writes
 * milestone-based narrative messages, newest first, into the chronicle
 * (`state/chronicle.ts`, Story 1.26), which keeps the last 100 and is saved
 * with the game. One-time lines are chronicle milestones, so a reload never
 * repeats them; a prestige starts a new chronicle.
 *
 * On NEST (Story 1.22, UX-DR30) it shows only the newest `NEST_LINES`: the
 * newest prefixed `> ` in accent, older ones `· ` in dim. The full log is
 * the LOG tab's. Hooks kept: `#activity-log` (set by UIRoot), `.log-entry`
 * per line, `[data-newest]`, `[data-line-prefix]`; a line that points at
 * something holds a `[data-jump=<panelId>]` button.
 */
export class EventLog {
  private container: HTMLDivElement;
  private logEl: HTMLOListElement;
  private chronicle: Chronicle;
  private jump?: LineJump;

  /** Stored callback references for unsubscribe. */
  private unsubscribeHandles: Array<() => void> = [];
  constructor(private bus: EventBus, options: EventLogOptions = {}) {
    this.chronicle = options.chronicle ?? createChronicle();
    this.jump = options.jump;
    this.container = document.createElement('div');
    this.container.className = 'event-log event-lines';

    // A `role="log"` region holding a real list (UX-DR40); it reads each new line once
    // (render keeps the old nodes).
    const region = document.createElement('div');
    region.className = 'event-lines__region';
    region.setAttribute('role', 'log');
    region.setAttribute('aria-label', 'Latest events');
    this.logEl = document.createElement('ol');
    this.logEl.className = 'event-lines__list';
    region.appendChild(this.logEl);
    this.container.appendChild(region);

    // A new chronicle opens with one line; a saved one already has its lines.
    if (this.chronicle.entries.peek().length === 0) this.addEntry(OPENING_LINE);
    // NEST redraws whenever the chronicle changes (a line, a load, a prestige).
    this.unsubscribeHandles.push(effect(() => this.render(this.chronicle.entries.value)));

    // A prestige starts a new run, and with it a new chronicle (GDD: a prestige wipes the run).
    const onPrestigeCb = () => {
      this.chronicle.reset();
      this.addEntry(PRESTIGE_LINE);
    };
    bus.subscribe('prestige_triggered', onPrestigeCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('prestige_triggered', onPrestigeCb));

    // Listen for events (milestone-based, no spam)
    const onClickCb = () => this.onClick();
    bus.subscribe('egg_clicked', onClickCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('egg_clicked', onClickCb));

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
      this.addEntry(`Scouts report a ${p.enemyName} in the territory.`, { target: 'battle_panel' });
    };
    bus.subscribe('enemy_scouted', onScoutCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('enemy_scouted', onScoutCb));

    const onEngageCb = (payload: unknown) => {
      const p = payload as { enemyType: string };
      this.addEntry(`The soldiers march to meet the ${p.enemyType}.`, { target: 'battle_panel' });
    };
    bus.subscribe('battle_engage', onEngageCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('battle_engage', onEngageCb));

    const onBattleDoneCb = (payload: unknown) => {
      const p = payload as { narrative: string };
      this.addEntry(p.narrative || 'The battle is over.', { target: 'battle_panel' });
    };
    bus.subscribe('battle_completed', onBattleDoneCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('battle_completed', onBattleDoneCb));

    const onExpeditionLaunchCb = (payload: unknown) => {
      const p = payload as { scouts: number; warriors: number; destination: string };
      const party = [];
      if (p.scouts > 0) party.push(`${p.scouts} scout${p.scouts > 1 ? 's' : ''}`);
      if (p.warriors > 0) party.push(`${p.warriors} warrior${p.warriors > 1 ? 's' : ''}`);
      this.addEntry(`An expedition departs for ${p.destination} — ${party.join(' and ')} march into the unknown.`, { target: 'expedition_panel' });
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
        this.addEntry(`Expedition returns triumphant from ${dest}! ${returnedStr} came back with ${lootStr}.`, { target: 'expedition_panel' });
      } else if (result === 'partial') {
        this.addEntry(`Expedition returns from ${dest} — battered but alive. ${returnedStr} made it back. Loot: ${lootStr}.`, { target: 'expedition_panel' });
      } else {
        this.addEntry(`The expedition to ${dest} has been lost. No one returned. The colony mourns.`, { target: 'expedition_panel' });
      }
    };
    bus.subscribe('expedition_return', onExpeditionReturnCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('expedition_return', onExpeditionReturnCb));

    const onBuildingCb = (payload: unknown) => {
      const p = payload as { building: string; level: number };
      const label = p.building.charAt(0).toUpperCase() + p.building.slice(1);
      if (p.level === 1) {
        this.addEntry(`${label} constructed — a new building rises in the colony.`, { target: 'building_panel' });
      } else {
        this.addEntry(`${label} upgraded to level ${p.level}. The colony grows stronger.`, { target: 'building_panel' });
      }
    };
    bus.subscribe('building_complete', onBuildingCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('building_complete', onBuildingCb));

    const onPhaseCb = ({ to }: { to: string }) => {
      this.onPhaseChanged(to);
    };
    bus.subscribe('phase_committed', onPhaseCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('phase_committed', onPhaseCb));

    const onExplorationReturnCb = (payload: unknown) => {
      const p = payload as { destination: string; result: string; voidCrystals: number; antimatter: number; darkMatter: number };
      const resources: string[] = [];
      if (p.voidCrystals > 0) resources.push(`${p.voidCrystals} void crystals`);
      if (p.antimatter > 0) resources.push(`${p.antimatter} antimatter`);
      if (p.darkMatter > 0) resources.push(`${p.darkMatter} dark matter`);
      const resStr = resources.length > 0 ? ` with ${resources.join(', ')}` : '';
      if (p.result === 'success' || p.result === 'partial') {
        this.addEntry(`Scouts return from ${p.destination}${resStr}.`, { target: 'exploration_panel' });
      } else {
        this.addEntry(`Scouts return from ${p.destination} — the mission yielded nothing.`, { target: 'exploration_panel' });
      }
    };
    bus.subscribe('exploration_return', onExplorationReturnCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('exploration_return', onExplorationReturnCb));

    const onProbeLaunchCb = (payload: unknown) => {
      const p = payload as { destination: string };
      this.addEntry(`Probe launched toward ${p.destination}.`, { target: 'exploration_panel' });
    };
    bus.subscribe('probe_launch', onProbeLaunchCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('probe_launch', onProbeLaunchCb));

    // A costly decision timed out (Story 1.28): what ignoring it cost goes into the log.
    const onDecisionCb = (p: { id: DecisionId; timedOut: boolean; policy: string }) => {
      if (p.timedOut && p.policy === 'costly') this.addEntry(timeoutLine(getDecision(p.id)));
    };
    bus.subscribe('decision_resolved', onDecisionCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('decision_resolved', onDecisionCb));

    const onNarrativeCb = (payload: unknown) => {
      const p = payload as { message: string };
      this.addEntry(p.message);
    };
    bus.subscribe('narrative', onNarrativeCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('narrative', onNarrativeCb));

    const onPanelCb = (payload: unknown) => {
      const p = payload as { panelId: string };
      this.onPanelRevealed(p.panelId);
    };
    bus.subscribe('panel_revealed', onPanelCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('panel_revealed', onPanelCb));

    const onPlanetClickCb = (payload: unknown) => {
      const p = payload as {
        name: string; type: string; yields?: string;
        accessibility?: string; requirement?: string; discovered?: boolean;
      };
      if (p.discovered === false) {
        this.addEntry(`Planet ${p.name}: undiscovered. ${p.requirement || 'Requires further exploration.'}`, { target: 'starmap_panel' });
      } else {
        this.addEntry(`Planet ${p.name} (${p.type}): ${p.yields}. ${p.accessibility || ''}`, { target: 'starmap_panel' });
      }
    };
    bus.subscribe('planet_clicked', onPlanetClickCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('planet_clicked', onPlanetClickCb));
  }

  /** Unsubscribe from all events. Call before discarding this EventLog. */
  destroy(): void {
    for (const unsub of this.unsubscribeHandles) {
      unsub();
    }
    this.unsubscribeHandles = [];
  }

  /** Every kept entry, newest first (the LOG tab reads the chronicle itself). */
  entries(): readonly LogEntry[] {
    return this.chronicle.entries.peek();
  }

  /**
   * True from a phase line until the current dispatch ends. A commit reveals
   * the phase's panels in the same synchronous dispatch, and their lines go
   * under the phase line, so NEST's newest line is the phase change.
   */
  private phaseLineOnTop = false;
  /** Entries ever added by this log (the chronicle itself stops growing at 100). */
  private added = 0;

  private addEntry(message: string, options: { under?: boolean; target?: PanelId } = {}): void {
    const at = options.under && this.phaseLineOnTop ? 1 : 0;
    this.added++;
    this.chronicle.add(message, { at, target: options.target });
  }

  /** A one-time line: written once per run, remembered through the save. */
  private once(milestone: string, message: string, options: { under?: boolean; target?: PanelId } = {}): void {
    if (this.chronicle.hasMilestone(milestone)) return;
    this.chronicle.markMilestone(milestone);
    this.addEntry(message, options);
  }

  /**
   * Draw the newest `NEST_LINES` entries, newest first. A line already drawn
   * keeps its node (only its prefix and `data-newest` change), so the log
   * region announces a new line once and never re-reads the old ones (Story 1.32).
   */
  private render(all: readonly LogEntry[]): void {
    const shown = all.slice(0, NEST_LINES);
    const kept = new Map<LogEntry, HTMLElement>();
    for (const el of [...this.logEl.children] as HTMLElement[]) {
      const entry = this.drawn.get(el);
      if (entry && shown.includes(entry) && !kept.has(entry)) kept.set(entry, el);
      else el.remove();
    }
    shown.forEach((entry, i) => {
      const line = kept.get(entry) ?? this.drawLine(entry);
      line.dataset.newest = i === 0 ? 'true' : 'false';
      const prefix = line.querySelector<HTMLElement>('[data-line-prefix]');
      if (prefix) prefix.textContent = i === 0 ? '> ' : '· ';
      // Already in place: leave it (moving a node would read it again).
      if (this.logEl.children[i] !== line) this.logEl.insertBefore(line, this.logEl.children[i] ?? null);
    });
  }

  /** Lines on screen and the entry each one draws. */
  private drawn = new WeakMap<HTMLElement, LogEntry>();

  private drawLine(entry: LogEntry): HTMLElement {
    const line = document.createElement('li');
    line.className = 'log-entry event-line';
    this.drawn.set(line, entry);
    const prefix = document.createElement('span');
    prefix.className = 'event-line__prefix';
    prefix.setAttribute('data-line-prefix', '');
    prefix.setAttribute('aria-hidden', 'true');
    line.appendChild(prefix);
    const target = entry.target;
    if (target && this.jump?.canJump(target)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'event-line__jump';
      btn.dataset.jump = target;
      btn.textContent = entry.message;
      btn.addEventListener('click', () => this.jump?.jump(target));
      line.appendChild(btn);
    } else {
      line.appendChild(document.createTextNode(entry.message));
    }
    return line;
  }

  private onClick(): void {
    this.once('first_egg', 'You lay your first egg. It is small, white, and perfect.');
  }

  private onWorkersChanged(): void {
    this.once('first_worker', 'The first worker emerges. She looks at you with absolute devotion.', {
      target: 'worker_assignment',
    });
  }

  notifyWorkerCount(count: number): void {
    if (count >= 10) {
      this.once('tenth_worker', 'The colony hums. You feel it through the soil.', { target: 'worker_assignment' });
    }
  }

  private onSoldiersChanged(count: number): void {
    if (count > 0) {
      this.once('first_soldier', 'The first soldier ant emerges. Her mandibles gleam with purpose.', {
        target: 'soldier_panel',
      });
    }
  }

  private onWeaponUpgraded(): void {
    this.once('first_weapon', "The soldiers' mandibles are honed sharper. Nature's design, perfected.", {
      target: 'soldier_panel',
    });
  }

  private onArmorUpgraded(): void {
    this.once('first_armor', 'Chitin plates are strapped to soldier thoraxes. The colony armors itself.', {
      target: 'soldier_panel',
    });
  }

  private onPhaseChanged(phase: string): void {
    const before = this.added;
    if (phase === 'colony') {
      this.once('phase_colony', 'The colony takes shape. Worker ants now serve a purpose — assign them.', {
        target: 'worker_assignment',
      });
    }
    if (phase === 'combat') {
      this.once('phase_combat', '⚔️ Danger lurks beyond the nest. Train soldiers, forge weapons, defend the colony.', {
        target: 'soldier_panel',
      });
    }
    if (phase === 'expansion') {
      this.once('phase_expansion', '🗺️ The world beyond the nest calls. Build, explore, expand your territory.', {
        target: 'map_panel',
      });
    }
    if (phase === 'space') {
      this.once('phase_space', '🚀 The swarm looks to the stars. New resources await in the void.', {
        target: 'spaceship_panel',
      });
    }
    if (this.added !== before) {
      this.phaseLineOnTop = true;
      queueMicrotask(() => {
        this.phaseLineOnTop = false;
      });
    }
  }

  private onPanelRevealed(panelId: string): void {
    // One line per panel and run: a reload reveals the panels again, and must not repeat it.
    const line = PANEL_LINES[panelId];
    if (line) this.once(`panel_${panelId}`, line, { under: true, target: panelId as PanelId });
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
