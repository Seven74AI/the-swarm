import type { GameState } from '../state/GameState';
import type { Phase } from '../phases/phases';
import type { BattleResult } from '../systems/BattleSystem';
import type { DecisionEvent } from '../systems/DecisionSystem';
import type { SpaceshipType } from '../systems/SpaceshipSystem';

/** Payload of an event that carries no data. */
export type NoPayload = Record<string, never>;

type WorkerRole = 'gather' | 'tend' | 'dig' | 'guard';
type Resources = GameState['resources'];

/**
 * Every event the game emits, with its payload type (AR18).
 *
 * There is deliberately no string index signature: emitting or subscribing to
 * a name that is not listed here, or passing the wrong payload, fails
 * `pnpm typecheck`. Names are `snake_case`, `noun_verb`, past tense for new
 * events. Events are notifications only; state is the authority.
 */
export interface SwarmEvents {
  // ── State and input ──
  /** Legacy `StateManager` notification (was `state:changed`). */
  state_changed: GameState;
  /** The queen laid an egg by tap/click (was `click:egg`). */
  egg_clicked: NoPayload;

  // ── Resources (ResourceSystem) ──
  eggs_changed: { eggs: number };
  larvae_changed: { larvae: number };
  food_changed: { food: number };
  wood_changed: { wood: number };
  stone_changed: { stone: number };
  nectar_changed: { nectar: number };
  workers_changed: { workers: number };
  upgrade_purchased: { upgradeId: string; level: number };
  workers_assigned: { role: WorkerRole; assigned: GameState['workersAssigned'] };

  // ── Combat ──
  soldiers_changed: { soldiers: number };
  soldier_recruited: { type: 'soldier'; count: number };
  weapon_upgraded: { level: number };
  armor_upgraded: { level: number };
  enemy_scouted: { enemyType: string; enemyName: string };
  battle_engage: { enemyType: string };
  battle_completed: BattleResult;

  // ── Decisions ──
  decision_event: DecisionEvent;
  decision_chosen: { type: DecisionEvent['type']; choice: string };
  decision_applied: { type: string; choice: string };

  // ── Phases and narrative ──
  /** CONTINUE entered the next phase (Story 1.19; replaces `phase_changed`). */
  phase_committed: { from: Phase; to: Phase };
  narrative: { message: string };
  victory: NoPayload;
  panel_revealed: { panelId: string };

  // ── Offline ──
  offline_progress: {
    elapsedMs: number;
    offlineTicks: number;
    efficiency: number;
    resourcesBefore: Resources;
    resourcesAfter: Resources;
  };

  // ── Expansion and space ──
  expedition_launch: { scouts: number; warriors: number; destination: string };
  expedition_return: {
    destination: string;
    result: 'success' | 'partial' | 'failure';
    food: number;
    stone: number;
    nectar: number;
    wood: number;
    scoutsReturned: number;
    warriorsReturned: number;
    tilesDiscovered: number;
  };
  exploration_return: {
    destination: string;
    result: 'success' | 'partial' | 'failure';
    voidCrystals: number;
    antimatter: number;
    darkMatter: number;
  };
  /** Listened for by the event log; no emitter yet. */
  probe_launch: { destination: string };
  spaceship_build: { level: number };
  spaceship_upgrade: { level: number };
  spaceship_return: {
    shipId: string;
    destination: string;
    shipType: SpaceshipType;
    shipLevel: number;
    voidCrystals: number;
    antimatter: number;
    darkMatter: number;
  };
  planet_clicked: {
    name: string;
    type: string;
    yields?: string;
    accessibility?: string;
    requirement?: string;
    discovered?: boolean;
  };

  // ── Buildings, mutations, research, automation ──
  building_complete: { building: string; level: number };
  mutation_purchased: { mutationId: string; name: string };
  research_complete: { research: string };
  auto_building_complete: { building: string; level: number };
  conversion_tick: { tick: number };

  // ── Prestige ──
  open_prestige_tree: NoPayload;
  prestige_triggered: {
    fromCount: number;
    toCount: number;
    legacyPointsGained: number;
    totalLegacyPoints: number;
  };
  prestige_upgrade_purchased: { upgradeId: string; upgradeName: string };
}

/** Anything events can be raised on: the live `EventBus`, or a tick's `EventQueue`. */
export interface EventSink<T extends object = SwarmEvents> {
  emit<K extends keyof T & string>(event: K, payload: T[K]): void;
}

/**
 * Collects events raised during a tick so they can be delivered after the
 * tick's state write (AR18). Systems raise events on it exactly as on a bus;
 * nothing reaches a listener until `flushTo()`.
 *
 * Offline catch-up uses one as a collecting bus and `clear()`s it, so nothing
 * plays or animates for simulated ticks.
 */
export class EventQueue<T extends object = SwarmEvents> implements EventSink<T> {
  private pending: { event: keyof T & string; payload: unknown }[] = [];

  emit<K extends keyof T & string>(event: K, payload: T[K]): void {
    this.pending.push({ event, payload });
  }

  /** Number of events waiting to be flushed. */
  get size(): number {
    return this.pending.length;
  }

  /** Deliver every queued event to `bus`, in the order raised, then empty the queue. */
  flushTo(bus: EventSink<T>): void {
    const batch = this.pending;
    this.pending = [];
    for (const { event, payload } of batch) {
      bus.emit(event, payload as T[typeof event]);
    }
  }

  /** Drop queued events without delivering them. */
  clear(): void {
    this.pending = [];
  }
}
