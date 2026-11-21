import { getDecision, timeoutLine, type DecisionId } from '../../data/content/decisions';
import type { EventBus } from '../../engine/EventBus';
import type { PanelId } from '../../data/content/tabs';
import { COLONY_LINES, colonyLine } from '../../data/content/colonyLines';
import { createChronicle, type Chronicle, type ChronicleEntry } from '../../state/chronicle';

/** One event line (kept in the chronicle, Story 1.26). */
export type LogEntry = ChronicleEntry;

/** The first line of a new chronicle. */
export const OPENING_LINE = COLONY_LINES.opening.text;
/** The first line after a prestige (EXPERIENCE.md Flow 7). */
export const PRESTIGE_LINE = COLONY_LINES.prestige.text;

export interface EventLogOptions {
  /** Where the lines go (main passes the saved one); default: a new chronicle. */
  chronicle?: Chronicle;
}

/** "Now available" lines, written once per run when a panel is first revealed. */
const PANEL_LINES: Readonly<Record<string, string>> = {
  soldier_panel: colonyLine('panel_soldier'),
  building_panel: colonyLine('panel_building'),
  expedition_panel: colonyLine('panel_expedition'),
  spaceship_panel: colonyLine('panel_spaceship'),
};

/** `2 SCOUTS AND 1 WARRIOR`, or `NO ONE`. */
function partyOf(scouts: number, warriors: number): string {
  const party: string[] = [];
  if (scouts > 0) party.push(`${scouts} scout${scouts > 1 ? 's' : ''}`);
  if (warriors > 0) party.push(`${warriors} warrior${warriors > 1 ? 's' : ''}`);
  return party.length > 0 ? party.join(' and ') : 'no one';
}

/**
 * The colony's event lines. Listens for game events and writes
 * milestone-based narrative messages, newest first, into the chronicle
 * (`state/chronicle.ts`, Story 1.26), which keeps the last 100 and is saved
 * with the game. One-time lines are chronicle milestones, so a reload never
 * repeats them; a prestige starts a new chronicle.
 *
 * It draws nothing (Story 1.36): NEST's newest lines are `ui/nest/EventLines`
 * and the full log is LOG's `ChronicleLog`, both views of the chronicle.
 */
export class EventLog {
  private chronicle: Chronicle;

  /** Stored callback references for unsubscribe. */
  private unsubscribeHandles: Array<() => void> = [];
  constructor(private bus: EventBus, options: EventLogOptions = {}) {
    this.chronicle = options.chronicle ?? createChronicle();
    // A new chronicle opens with one line; a saved one already has its lines.
    if (this.chronicle.entries.peek().length === 0) this.addEntry(OPENING_LINE);

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

    const onWorkersCb = ({ workers }: { workers: number }) => {
      this.onWorkersChanged();
      this.notifyWorkerCount(workers);
    };
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
      this.addEntry(colonyLine('enemy_scouted', { enemy: p.enemyName }), { target: 'battle_panel' });
    };
    bus.subscribe('enemy_scouted', onScoutCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('enemy_scouted', onScoutCb));

    const onEngageCb = (payload: unknown) => {
      const p = payload as { enemyType: string };
      this.addEntry(colonyLine('battle_engage', { enemy: p.enemyType }), { target: 'battle_panel' });
    };
    bus.subscribe('battle_engage', onEngageCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('battle_engage', onEngageCb));

    const onBattleDoneCb = (payload: unknown) => {
      const p = payload as { narrative: string };
      this.addEntry(p.narrative || colonyLine('battle_over'), { target: 'battle_panel' });
    };
    bus.subscribe('battle_completed', onBattleDoneCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('battle_completed', onBattleDoneCb));

    const onExpeditionLaunchCb = (payload: unknown) => {
      const p = payload as { scouts: number; warriors: number; destination: string };
      const party = partyOf(p.scouts, p.warriors);
      this.addEntry(colonyLine('expedition_launch', { destination: p.destination, party }), { target: 'expedition_panel' });
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

      const party = partyOf(scouts, warriors);

      const loot: string[] = [];
      if (food >= 1) loot.push(`${Math.floor(food)} food`);
      if (stone >= 1) loot.push(`${Math.floor(stone)} stone`);
      if (nectar >= 1) loot.push(`${Math.floor(nectar)} nectar`);
      if (wood >= 1) loot.push(`${Math.floor(wood)} wood`);
      const lootStr = loot.length > 0 ? loot.join(', ') : 'nothing';

      if (result === 'success' || result === 'partial') {
        const id = result === 'success' ? 'expedition_success' : 'expedition_partial';
        this.addEntry(colonyLine(id, { destination: dest, party, loot: lootStr }), { target: 'expedition_panel' });
      } else {
        this.addEntry(colonyLine('expedition_lost', { destination: dest }), { target: 'expedition_panel' });
      }
    };
    bus.subscribe('expedition_return', onExpeditionReturnCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('expedition_return', onExpeditionReturnCb));

    const onBuildingCb = (payload: unknown) => {
      const p = payload as { building: string; level: number };
      const building = p.building.replace(/[_-]+/g, ' ');
      if (p.level === 1) {
        this.addEntry(colonyLine('building_built', { building }), { target: 'building_panel' });
      } else {
        this.addEntry(colonyLine('building_upgraded', { building, level: p.level }), { target: 'building_panel' });
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
      if ((p.result === 'success' || p.result === 'partial') && resources.length > 0) {
        this.addEntry(colonyLine('exploration_return', { destination: p.destination, loot: resources.join(', ') }), {
          target: 'exploration_panel',
        });
      } else {
        this.addEntry(colonyLine('exploration_empty', { destination: p.destination }), { target: 'exploration_panel' });
      }
    };
    bus.subscribe('exploration_return', onExplorationReturnCb);
    this.unsubscribeHandles.push(() => bus.unsubscribe('exploration_return', onExplorationReturnCb));

    const onProbeLaunchCb = (payload: unknown) => {
      const p = payload as { destination: string };
      this.addEntry(colonyLine('probe_launch', { destination: p.destination }), { target: 'exploration_panel' });
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
        const requirement = p.requirement || 'it needs more exploration';
        this.addEntry(colonyLine('planet_uncharted', { name: p.name, requirement }), { target: 'starmap_panel' });
      } else {
        this.addEntry(colonyLine('planet_charted', { name: p.name, type: p.type, yields: p.yields ?? 'nothing' }), {
          target: 'starmap_panel',
        });
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

  private onClick(): void {
    this.once('first_egg', colonyLine('first_egg'));
  }

  private onWorkersChanged(): void {
    this.once('first_worker', colonyLine('first_worker'), {
      target: 'worker_assignment',
    });
  }

  notifyWorkerCount(count: number): void {
    if (count >= 10) {
      this.once('tenth_worker', colonyLine('tenth_worker'), { target: 'worker_assignment' });
    }
  }

  private onSoldiersChanged(count: number): void {
    if (count > 0) {
      this.once('first_soldier', colonyLine('first_soldier'), {
        target: 'soldier_panel',
      });
    }
  }

  private onWeaponUpgraded(): void {
    this.once('first_weapon', colonyLine('first_weapon'), {
      target: 'soldier_panel',
    });
  }

  private onArmorUpgraded(): void {
    this.once('first_armor', colonyLine('first_armor'), {
      target: 'soldier_panel',
    });
  }

  private onPhaseChanged(phase: string): void {
    const before = this.added;
    if (phase === 'colony') {
      this.once('phase_colony', colonyLine('phase_colony'), {
        target: 'worker_assignment',
      });
    }
    if (phase === 'combat') {
      this.once('phase_combat', colonyLine('phase_combat'), {
        target: 'soldier_panel',
      });
    }
    if (phase === 'expansion') {
      this.once('phase_expansion', colonyLine('phase_expansion'), {
        target: 'map_panel',
      });
    }
    if (phase === 'space') {
      this.once('phase_space', colonyLine('phase_space'), {
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
}
