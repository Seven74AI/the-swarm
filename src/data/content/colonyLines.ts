import { Phase } from '../../phases/phases';

/**
 * The colony's lines (Story 1.33, UX-DR42; EXPERIENCE.md "Voice and Tone"):
 * every event line and narrative beat the chronicle writes, in one place.
 *
 * The colony speaks in short, present-tense, upper-case terminal lines that
 * end with a full stop. No exclamation marks, no emoji, and no line names a
 * phase before `from`, the first phase it can be written in.
 * `tests/arch/voice.test.ts` checks every entry.
 *
 * `{name}` is a placeholder; `colonyLine()` fills it (upper case).
 */
export interface ColonyLine {
  readonly text: string;
  /** The first phase this line can be written in. */
  readonly from: Phase;
}

const lines = {
  // A new chronicle, and the first line after a prestige (EXPERIENCE.md Flow 7).
  opening: { text: 'A QUEEN WAKES ALONE IN THE DARK.', from: Phase.EGG_LAYING },
  prestige: { text: 'A QUEEN, AGAIN.', from: Phase.EGG_LAYING },

  // One-time beats.
  first_egg: { text: 'THE FIRST EGG. SMALL, WHITE, WHOLE.', from: Phase.EGG_LAYING },
  first_worker: { text: 'THE FIRST WORKER STIRS.', from: Phase.EGG_LAYING },
  tenth_worker: { text: 'TEN WORKERS. THE NEST HUMS.', from: Phase.EGG_LAYING },
  first_soldier: { text: 'THE FIRST SOLDIER STANDS READY.', from: Phase.COMBAT },
  first_weapon: { text: 'SOLDIER MANDIBLES ARE HONED SHARP.', from: Phase.COMBAT },
  first_armor: { text: 'CHITIN PLATES COVER THE SOLDIERS.', from: Phase.COMBAT },

  // Entering a phase: the log line, then the narrative beat.
  phase_colony: { text: 'THE COLONY TAKES SHAPE. WORKERS WAIT FOR ORDERS.', from: Phase.COLONY },
  phase_combat: { text: 'DANGER WAITS BEYOND THE NEST. SOLDIERS ARE NEEDED.', from: Phase.COMBAT },
  phase_expansion: { text: 'THE WORLD BEYOND THE NEST OPENS.', from: Phase.EXPANSION },
  phase_space: { text: 'THE SWARM LOOKS TO THE STARS.', from: Phase.SPACE },
  enter_combat: { text: 'THE FIRST THREAT REACHES THE NEST. GUARDS TAKE THEIR POSTS.', from: Phase.COMBAT },
  enter_expansion: { text: 'THE NEST HOLDS. THE SWARM PUSHES OUTWARD.', from: Phase.EXPANSION },
  enter_space: { text: 'ROCKETS CLIMB. THE SWARM LEAVES THE GROUND.', from: Phase.SPACE },
  enter_transcendence: { text: 'SPACE, TIME AND MATTER DISSOLVE. THE SWARM TRANSCENDS.', from: Phase.TRANSCENDENCE },

  // A panel opens (once per run).
  panel_soldier: { text: 'SOLDIERS CAN TRAIN NOW.', from: Phase.COMBAT },
  panel_building: { text: 'BUILDINGS CAN RISE NOW.', from: Phase.COLONY },
  panel_expedition: { text: 'EXPEDITIONS CAN LEAVE NOW.', from: Phase.EXPANSION },
  panel_spaceship: { text: 'A SHIP CAN BE BUILT NOW.', from: Phase.SPACE },

  // Battles.
  enemy_scouted: { text: 'SCOUTS SPOT A {enemy} NEAR THE NEST.', from: Phase.COMBAT },
  battle_engage: { text: 'THE SOLDIERS MARCH ON THE {enemy}.', from: Phase.COMBAT },
  battle_over: { text: 'THE BATTLE ENDS.', from: Phase.COMBAT },
  battle_no_soldiers: { text: 'NO SOLDIERS TO SEND.', from: Phase.COMBAT },
  battle_victory: { text: '{soldiers} SOLDIERS BEAT THE {enemy}. {lost} FALL. +{food} FOOD.', from: Phase.COMBAT },
  battle_venom: { text: 'VENOM DEALS {damage} DAMAGE.', from: Phase.COMBAT },
  battle_salvage: { text: 'THE SWARM SALVAGES {loot} FROM THE {enemy}.', from: Phase.COMBAT },
  battle_defeat: { text: 'THE {enemy} KILLS ALL {soldiers} SOLDIERS.', from: Phase.COMBAT },
  battle_midden: { text: 'THE MIDDEN TAKES {fallen} FALLEN. +{chitin} CHITIN.', from: Phase.COMBAT },
  battle_draw: { text: 'THE {enemy} RETREATS. {lost} SOLDIERS FALL.', from: Phase.COMBAT },
  // The battle summary's cause line (Story 4.3, UX-DR25); words in `battleCauses.ts`.
  cause_trait_beat: { text: '{their} {beat} YOUR {upgrade}.', from: Phase.COMBAT },
  cause_equipment_gap: { text: 'YOUR {upgrade} FELL SHORT.', from: Phase.COMBAT },
  cause_outnumbered: { text: 'TOO FEW SOLDIERS TO FINISH THEM.', from: Phase.COMBAT },
  cause_trait_countered: { text: 'YOUR {upgrade} BROKE {their}.', from: Phase.COMBAT },
  cause_outfought: { text: 'THE ARMY OUTFOUGHT THEM.', from: Phase.COMBAT },

  // The offline summary's warn lines (Story 2.9, UX-DR24); shown in any phase.
  offline_starved: { text: 'UPKEEP OUTRAN FOOD FOR {time}.', from: Phase.EGG_LAYING },
  offline_cap: { text: 'THE NEST STOPPED GROWING AFTER {cap}.', from: Phase.EGG_LAYING },

  // Expeditions, buildings, the stars.
  expedition_launch: { text: 'AN EXPEDITION LEAVES FOR {destination}: {party}.', from: Phase.EXPANSION },
  expedition_success: { text: 'THE EXPEDITION RETURNS FROM {destination} WITH {loot}. BACK: {party}.', from: Phase.EXPANSION },
  expedition_partial: { text: 'THE EXPEDITION LIMPS BACK FROM {destination} WITH {loot}. BACK: {party}.', from: Phase.EXPANSION },
  expedition_lost: { text: 'THE EXPEDITION TO {destination} DOES NOT RETURN.', from: Phase.EXPANSION },
  building_built: { text: 'THE {building} STANDS.', from: Phase.EXPANSION },
  building_upgraded: { text: 'THE {building} REACHES LEVEL {level}.', from: Phase.EXPANSION },
  exploration_return: { text: 'SCOUTS RETURN FROM {destination} WITH {loot}.', from: Phase.SPACE },
  exploration_empty: { text: 'SCOUTS RETURN FROM {destination} WITH NOTHING.', from: Phase.SPACE },
  probe_launch: { text: 'A PROBE LEAVES FOR {destination}.', from: Phase.SPACE },
  planet_uncharted: { text: 'PLANET {name} IS UNCHARTED. {requirement}.', from: Phase.SPACE },
  planet_charted: { text: 'PLANET {name}, {type}: {yields}.', from: Phase.SPACE },
} as const satisfies Record<string, ColonyLine>;

export type ColonyLineId = keyof typeof lines;

export const COLONY_LINES: Readonly<Record<ColonyLineId, ColonyLine>> = lines;

/**
 * A colony line with its placeholders filled. Values are upper-cased, and a
 * value's own closing full stop is dropped (the line supplies one).
 */
export function colonyLine(id: ColonyLineId, values: Readonly<Record<string, string | number>> = {}): string {
  return COLONY_LINES[id].text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    return v === undefined ? '' : String(v).trim().replace(/\.+$/, '').toUpperCase();
  });
}
