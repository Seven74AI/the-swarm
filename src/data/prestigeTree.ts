import { HOUR_MS, OFFLINE_CAP_RAISE_MS, OFFLINE_EFFICIENCY_STEP_POINTS } from './constants';

const CAP_RAISE_TEXT = `Offline cap +${OFFLINE_CAP_RAISE_MS / HOUR_MS} h`;

/**
 * Prestige Tree upgrade data.
 *
 * The prestige tree contains 11 permanent upgrades:
 *   - 5 production bonuses (Egg-laying +25%, Hatching +25%, Food +25%,
 *     Soldier training +25%, Worker efficiency +10%)
 *   - 3 unlock upgrades (Auto-egg-laying, Starting resources, Phase skip)
 *   - 3 offline upgrades (Story 2.8): offline efficiency +25 points, and two
 *     cap raises that take the offline cap from 12 h to 24 h
 *
 * Upgrades are purchased with Legacy Points and persist through Full Wipes.
 */

export type PrestigeUpgradeId =
  | 'egg_laying_bonus'
  | 'hatching_bonus'
  | 'food_bonus'
  | 'soldier_training_bonus'
  | 'worker_efficiency_bonus'
  | 'auto_egg_laying'
  | 'starting_resources'
  | 'phase_skip'
  | 'temporal_resonance'
  | 'chrono_synchronization'
  | 'long_dormancy';

export type PrestigeUpgradeEffect =
  | 'egg_laying'
  | 'hatching'
  | 'food'
  | 'soldier_training'
  | 'worker_efficiency'
  | 'auto_egg_laying'
  | 'starting_resources'
  | 'phase_skip'
  | 'offline_efficiency'
  | 'offline_cap';

export type PrestigeUpgradeType = 'production' | 'unlock' | 'offline';

export interface PrestigeUpgrade {
  id: PrestigeUpgradeId;
  name: string;
  description: string;
  cost: number;
  effect: PrestigeUpgradeEffect;
  type: PrestigeUpgradeType;
  icon: string;
  /** Phase requirement — only relevant for unlock-type upgrades */
  phaseRequired?: string;
  /** Upgrade IDs that must be purchased before this one */
  prerequisites: PrestigeUpgradeId[];
  /** Depth in the tree (0 = root node) */
  depth: number;
  /**
   * How much owning this node raises the offline cap, in ms (Story 2.4).
   * Summed by `getOfflineCapMs`.
   */
  offlineCapRaiseMs?: number;
  /** Percentage points owning this node adds to offline efficiency (Story 2.8, `getOfflineEfficiency`). */
  offlineEfficiencyPoints?: number;
}

/** All 11 prestige tree upgrades. */
export const PRESTIGE_UPGRADES: PrestigeUpgrade[] = [
  // ── Production Bonuses (5) ──
  {
    id: 'egg_laying_bonus',
    name: 'Fertile Queen',
    description: 'Egg-laying +25%',
    cost: 3,
    effect: 'egg_laying',
    type: 'production',
    icon: '🥚',
    prerequisites: [],
    depth: 0,
  },
  {
    id: 'hatching_bonus',
    name: 'Warm Nursery',
    description: 'Hatching +25%',
    cost: 3,
    effect: 'hatching',
    type: 'production',
    icon: '🐛',
    prerequisites: [],
    depth: 0,
  },
  {
    id: 'food_bonus',
    name: 'Efficient Foragers',
    description: 'Food +25%',
    cost: 3,
    effect: 'food',
    type: 'production',
    icon: '🍃',
    prerequisites: [],
    depth: 0,
  },
  {
    id: 'soldier_training_bonus',
    name: 'Hive Guard',
    description: 'Soldier training +25%',
    cost: 5,
    effect: 'soldier_training',
    type: 'production',
    icon: '⚔️',
    prerequisites: ['egg_laying_bonus'],
    depth: 1,
  },
  {
    id: 'worker_efficiency_bonus',
    name: 'Pheromone Sync',
    description: 'Worker efficiency +10%',
    cost: 5,
    effect: 'worker_efficiency',
    type: 'production',
    icon: '🐜',
    prerequisites: ['hatching_bonus'],
    depth: 1,
  },
  // ── Unlock Upgrades (3) ──
  {
    id: 'auto_egg_laying',
    name: 'Autonomous Queen',
    description: 'Auto egg-laying (1 egg/sec)',
    cost: 10,
    effect: 'auto_egg_laying',
    type: 'unlock',
    icon: '🔄',
    phaseRequired: 'egg_laying',
    prerequisites: ['worker_efficiency_bonus'],
    depth: 2,
  },
  {
    id: 'starting_resources',
    name: 'Royal Cache',
    description: 'Start with 50 eggs + 25 food',
    cost: 8,
    effect: 'starting_resources',
    type: 'unlock',
    icon: '📦',
    phaseRequired: 'egg_laying',
    prerequisites: ['food_bonus'],
    depth: 2,
  },
  {
    id: 'phase_skip',
    name: 'Ancestral Memory',
    description: 'Start at Phase 2 (colony)',
    cost: 12,
    effect: 'phase_skip',
    type: 'unlock',
    icon: '⚡',
    phaseRequired: 'egg_laying',
    prerequisites: ['auto_egg_laying'],
    depth: 3,
  },
  // ── Offline Upgrades (3, Story 2.8) ──
  // Temporal Resonance and Chrono Synchronization were one-off buys before
  // Story 2.8; the save migration grants these nodes to saves that owned them.
  {
    id: 'temporal_resonance',
    name: 'Temporal Resonance',
    description: `Offline efficiency +${OFFLINE_EFFICIENCY_STEP_POINTS} points`,
    cost: 10,
    effect: 'offline_efficiency',
    type: 'offline',
    icon: '🌀',
    prerequisites: [],
    depth: 0,
    offlineEfficiencyPoints: OFFLINE_EFFICIENCY_STEP_POINTS,
  },
  {
    id: 'chrono_synchronization',
    name: 'Chrono Synchronization',
    description: CAP_RAISE_TEXT,
    cost: 8,
    effect: 'offline_cap',
    type: 'offline',
    icon: '🔮',
    prerequisites: [],
    depth: 0,
    offlineCapRaiseMs: OFFLINE_CAP_RAISE_MS,
  },
  {
    id: 'long_dormancy',
    name: 'Long Dormancy',
    description: CAP_RAISE_TEXT,
    cost: 12,
    effect: 'offline_cap',
    type: 'offline',
    icon: '⏳',
    prerequisites: ['chrono_synchronization'],
    depth: 1,
    offlineCapRaiseMs: OFFLINE_CAP_RAISE_MS,
  },
];
