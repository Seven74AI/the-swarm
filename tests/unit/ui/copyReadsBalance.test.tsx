import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameState } from '../../../src/state/gameSignal';
import { createInitialState } from '../../../src/state/GameState';
import { Phase } from '../../../src/phases/phases';
import { sheetBalance } from '../../../src/data/balance/sheet';
import { researchBalance } from '../../../src/data/balance/research';
import { getProjects } from '../../../src/systems/ResearchSystem';
import { createResourceFeed } from '../../../src/ui/shell/resourceFeed';
import { createSheetController, type SheetController } from '../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../src/ui/shell/SheetHost';
import { openResourceSheet } from '../../../src/ui/sheets/ResourceSheet';
import { ResearchCards } from '../../../src/ui/build/ResearchCards';
import { formatDuration, formatFull } from '../../../src/utils/format';
import { testActions } from '../helpers/actions';
import { confirmSettings } from '../helpers/confirm';
import { makeState } from '../helpers/makeState';

/**
 * #466 (MVP retro F2): copy that states a rate, time, cost or share coming
 * from `data/balance/` reads it, so a retune can't leave the words behind
 * (the DIG tooltip said "+1 capacity per second" long after it wasn't, #433).
 * One test per kind of value: change the balance value, the copy follows.
 */

/** Run `body` with one balance field set to `value`, then put it back. */
function withBalance<T extends object>(obj: T, key: keyof T, value: number, body: () => void): void {
  const target = obj as Record<keyof T, number>;
  const before = target[key];
  target[key] = value;
  try {
    body();
  } finally {
    target[key] = before;
  }
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  gameState.value = createInitialState();
});

describe('a time in copy follows its balance value (resource sheet header)', () => {
  let sheets: SheetController;
  beforeEach(() => {
    sheets = createSheetController();
    render(<SheetHost sheets={sheets} />);
  });

  const header = () => {
    gameState.value = { ...createInitialState(), phase: Phase.COLONY };
    act(() => void openResourceSheet(sheets, createResourceFeed()));
    const text = document.querySelector('[data-resource-header]')!.textContent ?? '';
    act(() => sheets.close(sheets.state.value.open!.id));
    return text;
  };

  it('names the sparkline window it draws, and a changed window changes the words', () => {
    const shown = (ms: number) => `LAST ${formatDuration(ms).toUpperCase()}`;
    expect(header()).toContain(shown(sheetBalance.sparkWindowMs));
    const doubled = sheetBalance.sparkWindowMs * 2;
    withBalance(sheetBalance, 'sparkWindowMs', doubled, () => {
      const text = header();
      expect(text).toContain(shown(doubled));
      expect(text).not.toContain(shown(doubled / 2));
    });
  });
});

describe('a share in copy follows its balance value (research cancel refund)', () => {
  const vcs = getProjects().find((p) => p.prerequisite === null)!;
  const running = () =>
    makeState({
      phase: Phase.SPACE,
      resources: { workers: 200, stone: 10_000, nectar: 10_000 },
      workersAssigned: { researchers: vcs.requiredResearchers },
      research: { projects: { [vcs.id]: { status: 'running', progressMs: 0, durationMs: vcs.durationMs } } },
    });

  const card = () => {
    gameState.value = running();
    const actions = testActions();
    const { container, unmount } = render(
      <ResearchCards start={(id) => actions.startResearch(id)} cancel={(id) => actions.cancelResearch(id)} confirmSettings={confirmSettings()} />,
    );
    const el = container.querySelector(`[data-research-project="${vcs.id}"]`)!;
    const label = el.querySelector('[data-action="cancel-research"]')!.getAttribute('aria-label') ?? '';
    const refund = el.querySelector('[data-refund]')!.textContent ?? '';
    unmount();
    return { label, refund };
  };

  it('states the refund share and the refunded amounts, and a changed share changes both', () => {
    for (const share of [researchBalance.cancelRefundShare, researchBalance.cancelRefundShare / 2]) {
      withBalance(researchBalance, 'cancelRefundShare', share, () => {
        const { label, refund } = card();
        expect(label).toContain(`(${formatFull(Math.floor(share * 100))} % BACK)`);
        for (const amount of Object.values(vcs.cost) as number[]) {
          const back = Math.floor(amount * share);
          if (back > 0) expect(refund).toContain(formatFull(back));
        }
      });
    }
  });
});

/**
 * The guard: no string in `data/content/` states a number with a rate or time
 * unit. Such a number belongs in `data/balance/`, read by the copy. A string
 * that must keep one is allowlisted here, with the reason.
 */
const CONTENT_DIR = join(__dirname, '../../../src/data/content');
const ALLOWLIST: Readonly<Record<string, string>> = {
  // 'file.ts: the string': 'why it may state its number',
};
/** A digit, then a rate or time unit: `3/s`, `+1 capacity per second`, `10 s`, `5 min`, `2 h`. */
const NUMBER_WITH_UNIT = /\d\s*\/\s*s\b|\d[^·.\n{}]{0,30}?\bper\s+sec(ond)?\b|\d\s+s\b|\d\s*min(ute)?s?\b|\d\s*h(ours?)?\b|\d\s*sec(ond)?s?\b/i;

/** The string literals of a TypeScript source, comments dropped. */
function stringLiterals(source: string): string[] {
  // One pass, left to right: a comment is skipped whole, so its apostrophes never open a string.
  const out: string[] = [];
  const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const literal = m[1] ?? m[2] ?? m[3];
    if (literal !== undefined) out.push(literal);
  }
  return out;
}

describe('no content string states a number with a rate or time unit', () => {
  it('the matcher catches the shapes it guards against, and lets plain copy through', () => {
    for (const bad of ['+1 capacity per second', '3/S', 'BACK IN 10 S', 'LAST 10 MIN', 'EVERY 2 H', 'LASTS 30 SECONDS']) {
      expect(NUMBER_WITH_UNIT.test(bad), bad).toBe(true);
    }
    for (const fine of ['THE COLD TAKES 25% OF THE EGGS', '+{n} PER SECOND', 'FOOD LASTS {time}', 'SCOUTS', '1 IN 3: −1 WORKER']) {
      expect(NUMBER_WITH_UNIT.test(fine), fine).toBe(false);
    }
    expect(stringLiterals(`/* it's 5 min */ const a = 'one'; // 'not this'\nconst b = \`two \${x}\`;`)).toEqual(['one', 'two ${x}']);
  });

  it('every content file passes, or its string is allowlisted with a reason', () => {
    const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const f of files) {
      for (const s of stringLiterals(readFileSync(join(CONTENT_DIR, f), 'utf8'))) {
        const key = `${f}: ${s}`;
        if (NUMBER_WITH_UNIT.test(s) && !(key in ALLOWLIST)) bad.push(key);
      }
    }
    expect(bad).toEqual([]);
    for (const reason of Object.values(ALLOWLIST)) expect(reason.trim()).not.toBe('');
  });
});
