import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventBus } from '../../../src/engine/EventBus';
import { GAME_FEEL, FEEL_TRIGGERS, hapticFor } from '../../../src/platform/gameFeel';
import { bindHapticFeedback, bindPressHaptics, SOUND_EVENTS } from '../../../src/platform/feedback';
import { SOUND_CUES } from '../../../src/platform/audio';
import { HAPTIC_PATTERNS, type HapticPattern, type Haptics } from '../../../src/platform/haptics';
import { EVENT_NAMES, EVENT_SAMPLES } from '../helpers/eventSamples';

/**
 * Story 8.9 (FR41, UX-DR37): the game-feel table of EXPERIENCE.md is data.
 * Every trigger lists all three channels (visual, haptic, sound), a haptic
 * never stands alone, and the haptic binding plays what the table says.
 */

function recorder(): Haptics & { played: HapticPattern[] } {
  const played: HapticPattern[] = [];
  return { played, play: (p) => void played.push(p) };
}

const uiText = (() => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/ui');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(join(dir, d.name)) : /\.(tsx?|css)$/.test(d.name) ? [readFileSync(join(dir, d.name), 'utf8')] : [],
    );
  return walk(root);
})();

describe('the game-feel table (Story 8.9)', () => {
  it('has one row for each trigger of EXPERIENCE.md, in order', () => {
    expect(GAME_FEEL.map((r) => r.trigger)).toEqual([...FEEL_TRIGGERS]);
    expect(new Set(FEEL_TRIGGERS).size).toBe(FEEL_TRIGGERS.length);
  });

  it('every row names all three channels: a visual, a haptic (or none) and a sound (or none)', () => {
    for (const row of GAME_FEEL) {
      expect(row.visual.hooks.length, row.trigger).toBeGreaterThan(0);
      expect(row.visual.description.length, row.trigger).toBeGreaterThan(0);
      expect(row.haptic, row.trigger).toBeDefined();
      expect(row.sound, row.trigger).toBeDefined();
    }
  });

  it('every visual hook exists in the UI, so nothing is felt or heard without being seen', () => {
    for (const row of GAME_FEEL) {
      for (const hook of row.visual.hooks) expect(uiText.some((t) => t.includes(hook)), `${row.trigger}: ${hook}`).toBe(true);
    }
  });

  it('haptic patterns are real patterns, and a row that vibrates says what fires it', () => {
    for (const row of GAME_FEEL) {
      if (row.haptic === 'none') continue;
      const patterns = typeof row.haptic === 'string' ? [row.haptic] : [row.haptic.win, row.haptic.loss];
      for (const p of patterns) expect(Object.keys(HAPTIC_PATTERNS), row.trigger).toContain(p);
      expect(row.events.length > 0 || row.press === true, row.trigger).toBe(true);
    }
  });

  it('a battle win and a loss feel different', () => {
    const battle = GAME_FEEL.find((r) => r.trigger === 'battle-result')!;
    expect(hapticFor(battle, { victory: true })).not.toBe(hapticFor(battle, { victory: false }));
  });

  it('every sound a row lists plays for that row\'s events (SOUND_EVENTS, Story 8.8)', () => {
    for (const row of GAME_FEEL) {
      if (row.sound === 'none') continue;
      for (const cue of row.sound) expect(SOUND_CUES, row.trigger).toContain(cue);
      expect(row.events.length, row.trigger).toBeGreaterThan(0);
      for (const event of row.events) {
        const heard = SOUND_EVENTS.find((e) => e.event === event);
        expect(heard, `${row.trigger}: ${event}`).toBeDefined();
        for (const cue of heard!.cues) expect(row.sound, `${row.trigger}: ${event}`).toContain(cue);
      }
    }
  });
});

describe('haptics follow the table', () => {
  it('each row\'s events play its pattern, and no other event vibrates', () => {
    const bus = new EventBus();
    const h = recorder();
    bindHapticFeedback(bus, h);
    const felt = new Set<string>();
    for (const row of GAME_FEEL) {
      for (const event of row.events) {
        felt.add(event);
        h.played.length = 0;
        bus.emit(event, EVENT_SAMPLES[event] as never);
        // A buy's haptic is on the press itself (bindPressHaptics), not on each repeat's event.
        if (row.haptic === 'none' || row.press) expect(h.played, `${row.trigger}: ${event}`).toEqual([]);
        else expect(h.played, `${row.trigger}: ${event}`).toEqual([hapticFor(row, EVENT_SAMPLES[event])]);
      }
    }
    h.played.length = 0;
    for (const name of EVENT_NAMES.filter((n) => !felt.has(n))) bus.emit(name, EVENT_SAMPLES[name] as never);
    expect(h.played).toEqual([]);
  });
});

describe('press haptics (Story 8.9: "light on press" for a buy)', () => {
  afterEach(() => document.body.replaceChildren());

  function setup(markup: string) {
    document.body.innerHTML = markup;
    const h = recorder();
    const unbind = bindPressHaptics(document, h);
    const press = (sel: string) =>
      document.querySelector(sel)!.dispatchEvent(new (window.PointerEvent ?? MouseEvent)('pointerdown', { bubbles: true, button: 0 }));
    return { h, unbind, press };
  }

  const pressRow = () => GAME_FEEL.find((r) => r.press)!;

  it('a press on a buy button plays the press row\'s pattern once, at pointer-down', () => {
    const { h, press } = setup('<button data-feel="press"><span id="inner">BUY</span></button>');
    press('#inner');
    expect(h.played).toEqual([pressRow().haptic]);
  });

  it('plays nothing for a disabled buy, a non-buy button, or after unbinding', () => {
    const { h, press, unbind } = setup(
      '<button id="off" data-feel="press" aria-disabled="true">BUY</button><button id="plain">OK</button><button id="on" data-feel="press">BUY</button>',
    );
    press('#off');
    press('#plain');
    expect(h.played).toEqual([]);
    unbind();
    press('#on');
    expect(h.played).toEqual([]);
  });
});
