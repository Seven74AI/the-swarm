import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';

export interface DecisionChoice {
  label: string;
  description: string;
}

export interface DecisionEvent {
  type: 'beetle' | 'overcrowding' | 'scouts';
  title: string;
  description: string;
  choices: DecisionChoice[];
}

interface DecisionConsequence {
  type: 'beetle' | 'overcrowding' | 'scouts';
  label: string;
  apply: (state: GameState) => GameState;
}

const EVENT_POOL: DecisionEvent[] = [
  {
    type: 'beetle',
    title: 'Beetle Sighting',
    description:
      'A worker spotted a large beetle near the colony. Its carcass could yield food, but collecting it is dangerous.',
    choices: [
      { label: 'Collect', description: 'Send workers to retrieve the beetle (+food, risk losing a worker)' },
      { label: 'Ignore', description: 'Leave it. The risk is not worth it.' },
    ],
  },
  {
    type: 'overcrowding',
    title: 'Overcrowding!',
    description:
      'The nest is getting cramped. Workers are agitated and productivity is slipping.',
    choices: [
      { label: 'Expand', description: 'Expand the nest (+nest capacity, -food cost)' },
      { label: 'Cull', description: 'Reduce the population to ease pressure (-workers, +stability)' },
      { label: 'Wait', description: 'Hold steady and see if conditions improve.' },
    ],
  },
  {
    type: 'scouts',
    title: 'Scout Report',
    description:
      'Scouts have discovered unusual activity nearby. They can investigate further, but it may be dangerous.',
    choices: [
      { label: 'Investigate', description: 'Send scouts to investigate (discovers new tiles, risk to scouts)' },
      { label: 'Ignore', description: 'Better to focus on the colony for now.' },
    ],
  },
];

const CONSEQUENCES: Record<string, Record<string, (state: GameState) => GameState>> = {
  beetle: {
    Collect: (state: GameState): GameState => ({
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food + 15,
        workers: Math.max(0, state.resources.workers - 1),
      },
    }),
    Ignore: (state: GameState): GameState => ({ ...state }),
  },
  overcrowding: {
    Expand: (state: GameState): GameState => {
      const cost = 25;
      if (state.resources.food < cost) {
        return {
          ...state,
          resources: {
            ...state.resources,
            food: Math.max(0, state.resources.food - cost),
          },
        };
      }
      return {
        ...state,
        resources: {
          ...state.resources,
          food: state.resources.food - cost,
          nestCapacity: state.resources.nestCapacity + 10,
        },
      };
    },
    Cull: (state: GameState): GameState => ({
      ...state,
      resources: {
        ...state.resources,
        workers: Math.max(0, Math.floor(state.resources.workers * 0.9)),
      },
    }),
    Wait: (state: GameState): GameState => ({ ...state }),
  },
  scouts: {
    Investigate: (state: GameState): GameState => {
      const undiscovered = state.mapTiles.filter((t) => !t.discovered);
      if (undiscovered.length === 0) return { ...state };

      const count = Math.min(3, undiscovered.length, 1 + Math.floor(Math.random() * 3));
      const shuffled = [...undiscovered].sort(() => Math.random() - 0.5);
      const toDiscover = shuffled.slice(0, count);

      const newTiles = state.mapTiles.map((t) => {
        if (toDiscover.some((d) => d.x === t.x && d.y === t.y)) {
          return { ...t, discovered: true };
        }
        return t;
      });

      return {
        ...state,
        mapTiles: newTiles,
        soldiers: {
          ...state.soldiers,
          scouts: Math.max(0, state.soldiers.scouts - 1),
        },
      };
    },
    Ignore: (state: GameState): GameState => ({ ...state }),
  },
};

/**
 * DecisionSystem manages the decision popup spawn timer and consequences.
 *
 * Events spawn every 2-3 minutes of play time. Each event has 2-4 choices.
 * Choices apply consequences immediately to the game state.
 * Events auto-dismiss after 30s if ignored (handled by the UI component).
 */
export class DecisionSystem {
  private nextSpawnAt: number;

  constructor(private bus: EventBus) {
    this.nextSpawnAt = this.randomInterval();
  }

  /**
   * Try to pop a decision event. Returns null if it's not time yet.
   * @param state  Current game state (used to check eligibility).
   * @param elapsedMs  Total play time elapsed in milliseconds.
   */
  popEvent(state: GameState, elapsedMs: number): DecisionEvent | null {
    if (elapsedMs < this.nextSpawnAt) {
      return null;
    }

    // Reset cooldown first (prevents double-fire on rapid calls)
    this.nextSpawnAt = elapsedMs + this.randomInterval();

    // Pick a random event from the pool
    const idx = Math.floor(Math.random() * EVENT_POOL.length);
    const event = EVENT_POOL[idx];

    return event;
  }

  /**
   * Apply a decision choice and return the new game state.
   * Emits 'decision_applied' event on the bus.
   */
  applyChoice(state: GameState, eventType: string, choiceLabel: string): GameState {
    const consequencesForType = CONSEQUENCES[eventType];
    if (!consequencesForType) return state;

    const apply = consequencesForType[choiceLabel];
    if (!apply) return state;

    const newState = apply(state);

    this.bus.emit('decision_applied', {
      type: eventType,
      choice: choiceLabel,
    });

    return newState;
  }

  private randomInterval(): number {
    // 120,000 ms (2 min) to 180,000 ms (3 min)
    return 120_000 + Math.floor(Math.random() * 60_000);
  }
}
