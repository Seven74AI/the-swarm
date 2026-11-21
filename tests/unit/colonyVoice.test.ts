/**
 * Story 1.33 (UX-DR42): every line the colony writes keeps the colony voice,
 * whatever the event: short, upper case, present tense, a full stop, no
 * exclamation mark. Drives the real writers (EventLog, the battle system, the
 * phase transitions) rather than checking strings one by one.
 */
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import type { SwarmEvents } from '../../src/engine/events';
import { EventLog } from '../../src/ui/panels/EventLog';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { TRANSITIONS } from '../../src/phases/transitions';
import { PHASE_ORDER } from '../../src/phases/phases';
import { EVENT_NAMES, EVENT_SAMPLES } from './helpers/eventSamples';
import { colonyVoiceProblem } from '../arch/voice';

const problems = (lines: readonly string[]): string[] =>
  lines.flatMap((l) => {
    const p = colonyVoiceProblem(l);
    return p ? [`"${l}" ${p}`] : [];
  });

/** Payload variants that reach every branch of EventLog's line writers. */
const VARIANTS: { [K in keyof SwarmEvents]?: SwarmEvents[K][] } = {
  phase_committed: PHASE_ORDER.slice(1).map((to, i) => ({ from: PHASE_ORDER[i], to })),
  expedition_launch: [
    { scouts: 2, warriors: 1, destination: 'meadow' },
    { scouts: 1, warriors: 0, destination: 'forest' },
  ],
  expedition_return: (['success', 'partial', 'failure'] as const).map((result) => ({
    ...EVENT_SAMPLES.expedition_return,
    result,
    food: 12,
    stone: 3,
    scoutsReturned: 2,
    warriorsReturned: 1,
  })),
  exploration_return: [
    { destination: 'kepler', result: 'success', voidCrystals: 5, antimatter: 2, darkMatter: 1 },
    { destination: 'kepler', result: 'failure', voidCrystals: 0, antimatter: 0, darkMatter: 0 },
  ],
  building_complete: [
    { building: 'venom_lab', level: 1 },
    { building: 'walls', level: 3 },
  ],
  planet_clicked: [
    { name: 'kepler', type: 'rocky', discovered: false, requirement: 'Build a spaceship and launch a probe.' },
    { name: 'kepler', type: 'rocky', discovered: false },
    { name: 'kepler', type: 'rocky', discovered: true, yields: 'Antimatter' },
  ],
  panel_revealed: ['soldier_panel', 'building_panel', 'expedition_panel', 'spaceship_panel'].map((panelId) => ({ panelId })),
  battle_completed: [{ ...EVENT_SAMPLES.battle_completed, narrative: '' }],
};

describe('the colony voice in every line the game writes', () => {
  it('EventLog writes only colony-voice lines, for every event', () => {
    const bus = new EventBus();
    const log = new EventLog(bus);
    for (const name of EVENT_NAMES) {
      // Lines that come from elsewhere (narrative, battle results) are checked at their source below.
      if (name === 'narrative' || name === 'battle_completed' || name === 'prestige_triggered') continue;
      for (const payload of VARIANTS[name] ?? [EVENT_SAMPLES[name]]) {
        bus.emit(name, payload as never);
      }
    }
    for (const payload of VARIANTS.battle_completed!) bus.emit('battle_completed', payload);
    log.notifyWorkerCount(10);
    const lines = log.entries().map((e) => e.message);
    // A prestige starts a new chronicle with its own line.
    bus.emit('prestige_triggered', EVENT_SAMPLES.prestige_triggered);
    lines.push(...log.entries().map((e) => e.message));
    expect(lines.length).toBeGreaterThan(10);
    expect(problems(lines)).toEqual([]);
  });

  it('every battle narrative keeps the voice, whatever the outcome', () => {
    const narratives = new Set<string>();
    const system = new BattleSystem(new EventBus());
    const army = (soldiers: number, gear: number): GameState => {
      const s = createInitialState();
      return {
        ...s,
        combatSoldiers: soldiers,
        equipment: { ...s.equipment, weapon: gear, armor: gear },
        buildings: { ...s.buildings, venom_lab: { ...s.buildings.venom_lab, level: 2 } },
        combatResources: { ...s.combatResources, venom: 50 },
      };
    };
    for (const [soldiers, gear] of [[0, 0], [1, 0], [3, 0], [40, 5], [200, 5]]) {
      for (let i = 0; i < 20; i++) narratives.add(system.resolveBattle(army(soldiers, gear)).result.narrative);
    }
    expect(problems([...narratives])).toEqual([]);
  });

  it('every phase transition narrative keeps the voice', () => {
    const lines: string[] = [];
    const bus = new EventBus();
    bus.subscribe('narrative', (p) => lines.push(p.message));
    for (const t of TRANSITIONS) t.onEnter?.(createInitialState(), bus);
    expect(lines.length).toBeGreaterThan(0);
    expect(problems(lines)).toEqual([]);
  });
});
