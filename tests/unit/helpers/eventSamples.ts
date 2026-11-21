import type { SwarmEvents } from '../../../src/engine/events';
import { createInitialState } from '../../../src/state/GameState';
import { Phase } from '../../../src/phases/phases';

/**
 * One plausible payload for every event in `SwarmEvents`.
 *
 * The mapped type makes this list exhaustive: adding an event to
 * `SwarmEvents` without a sample here fails `pnpm typecheck`, so tests that
 * walk every event (listener write checks, tick ordering) stay complete.
 */
export const EVENT_SAMPLES: { [K in keyof SwarmEvents]: SwarmEvents[K] } = {
  state_changed: createInitialState(),
  egg_clicked: {},
  eggs_changed: { eggs: 1 },
  larvae_changed: { larvae: 1 },
  food_changed: { food: 1 },
  wood_changed: { wood: 1 },
  stone_changed: { stone: 1 },
  nectar_changed: { nectar: 1 },
  workers_changed: { workers: 1 },
  upgrade_purchased: { upgradeId: 'sample_upgrade', level: 1 },
  workers_assigned: { role: 'gather', assigned: createInitialState().workersAssigned },
  soldiers_changed: { soldiers: 1 },
  soldier_recruited: { type: 'soldier', count: 1 },
  weapon_upgraded: { level: 1 },
  armor_upgraded: { level: 1 },
  battle_completed: {
    victory: true,
    outcome: 'victory',
    rounds: 3,
    soldiersLost: 0,
    enemyType: 'beetle',
    foodGained: 0,
    specialLoot: { chitin: 0, silk: 0, venom: 0 },
    poisonDamageDealt: 0,
    narrative: 'sample',
  },
  decision_event: {
    type: 'beetle',
    title: 'sample',
    description: 'sample',
    choices: [{ label: 'sample', description: 'sample' }],
  },
  decision_chosen: { type: 'beetle', choice: 'Ignore' },
  decision_applied: { type: 'beetle', choice: 'sample' },
  phase_committed: { from: Phase.EGG_LAYING, to: Phase.COLONY },
  narrative: { message: 'sample' },
  victory: {},
  offline_progress: {
    elapsedMs: 60_000,
    offlineTicks: 1,
    efficiency: 1,
    resourcesBefore: createInitialState().resources,
    resourcesAfter: createInitialState().resources,
  },
  expedition_launch: { scouts: 1, warriors: 0, destination: 'sample' },
  expedition_return: {
    destination: 'sample',
    result: 'success',
    food: 0,
    stone: 0,
    nectar: 0,
    wood: 0,
    scoutsReturned: 1,
    warriorsReturned: 0,
    tilesDiscovered: 0,
  },
  exploration_return: { destination: 'sample', result: 'failure', voidCrystals: 0, antimatter: 0, darkMatter: 0 },
  probe_launch: { destination: 'sample' },
  spaceship_build: { level: 1 },
  spaceship_upgrade: { level: 2 },
  spaceship_return: {
    shipId: 'sample',
    destination: 'sample',
    shipType: 'scout_ship',
    shipLevel: 1,
    voidCrystals: 0,
    antimatter: 0,
    darkMatter: 0,
  },
  planet_clicked: { name: 'sample', type: 'sample', discovered: false },
  panel_revealed: { panelId: 'sample_panel' },
  enemy_scouted: { enemyType: 'beetle', enemyName: 'sample' },
  battle_engage: { enemyType: 'beetle' },
  mutation_purchased: { mutationId: 'sample', name: 'sample' },
  open_prestige_tree: {},
  prestige_triggered: { fromCount: 0, toCount: 1, legacyPointsGained: 1, totalLegacyPoints: 1 },
  prestige_upgrade_purchased: { upgradeId: 'sample', upgradeName: 'sample' },
  conversion_tick: { tick: 1 },
  research_complete: { research: 'sample' },
  auto_building_complete: { building: 'sample', level: 1 },
  building_complete: { building: 'warehouse', level: 1 },
};

export const EVENT_NAMES = Object.keys(EVENT_SAMPLES) as (keyof SwarmEvents)[];
