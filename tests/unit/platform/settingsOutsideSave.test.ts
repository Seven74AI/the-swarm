import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/engine/EventBus';
import { SaveManager } from '../../../src/persistence/SaveManager';
import { createLocalSaveStore } from '../../../src/platform/storage/SaveStore';
import { SETTINGS_KEY, createSettingsStore } from '../../../src/platform/settings';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { testActions } from '../helpers/actions';

const caps = { vibrate: true, standalone: false, reducedMotion: false, moreContrast: false };
const BIG = 1_000_000_000;

/** A state that clears every prestige requirement by a wide margin. */
function prestigeReady(): GameState {
  const s = createInitialState();
  for (const b of Object.values(s.buildings)) b.level = 99;
  s.prestige = {
    ...s.prestige,
    totalFoodProduced: BIG,
    totalWoodProduced: BIG,
    totalStoneProduced: BIG,
    totalNectarProduced: BIG,
  };
  return s;
}

describe('settings live outside the game save (Story 1.10, D4)', () => {
  beforeEach(() => localStorage.clear());

  function changedSettings() {
    const store = createSettingsStore({ storage: localStorage, capabilities: caps });
    store.update({ sound: true, crt: 'full', layMode: 'toggle' });
    return store;
  }

  it('are not part of a save', () => {
    changedSettings();
    new SaveManager(createLocalSaveStore(localStorage)).save(createInitialState(), 0, true);
    const raw = localStorage.getItem('the_swarm_save') ?? '';
    expect(raw).not.toBe('');
    expect(raw).not.toContain(SETTINGS_KEY);
    const save = JSON.parse(raw);
    expect(save).not.toHaveProperty('settings');
    expect(save.gameState).not.toHaveProperty('settings');
  });

  it('survive prestige', () => {
    const store = changedSettings();
    const before = { value: store.settings.value, raw: localStorage.getItem(SETTINGS_KEY) };
    let state = prestigeReady();
    const actions = testActions(new EventBus(), () => state, (s) => {
      state = s;
    });
    expect(actions.prestige().ok).toBe(true);
    expect(store.settings.value).toBe(before.value);
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(before.raw);
    expect(createSettingsStore({ storage: localStorage, capabilities: caps }).settings.value).toEqual(before.value);
  });

  it('survive loading or deleting a save', () => {
    const store = changedSettings();
    const raw = localStorage.getItem(SETTINGS_KEY);
    const mgr = new SaveManager(createLocalSaveStore(localStorage));
    mgr.save(prestigeReady(), 0, true);
    expect(mgr.load()).not.toBeNull();
    mgr.deleteSave();
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(raw);
    expect(createSettingsStore({ storage: localStorage, capabilities: caps }).settings.value).toEqual(store.settings.value);
  });
});
