/**
 * Story 1.33 (UX-DR42): the game speaks in one voice. These tests scan the
 * copy itself (every literal in `src/`, and the content tables) for the
 * voice rules in `./voice.ts`, so a new line is checked the day it is written.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findJsxText, listSources, strip, type SourceFile } from './scan';
import { NOT_PLAIN, colonyVoiceProblem, namesLaterPhase } from './voice';
import { PHASE_ORDER, Phase } from '../../src/phases/phases';
import { TRANSITIONS } from '../../src/phases/transitions';
import { COLONY_LINES } from '../../src/data/content/colonyLines';
import { PHASE_TITLES, REVEAL_LINES } from '../../src/data/content/phaseReveal';
import { MVP_PHASES, NARRATIVE_BEATS } from '../../src/data/content/narrative';
import { DECISIONS, timeoutLine } from '../../src/data/content/decisions';
import { SEGMENTS, TABS } from '../../src/data/content/tabs';
import { ROLES } from '../../src/data/content/roles';
import { TRAITS } from '../../src/data/content/enemies';
import { RESOURCES } from '../../src/ui/shell/resourceCatalog';
import { causeLine, LOSS_CAUSES, WIN_CAUSES } from '../../src/systems/BattleCauses';
import { CAUSE_UPGRADE_WORDS } from '../../src/data/content/battleCauses';
import { AUTOMATION_BLOCK_TEXT, AUTOMATION_VERBS } from '../../src/data/content/automation';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'src');
const sources = listSources(SRC);

interface Copy {
  where: string;
  text: string;
}

const lineOf = (f: SourceFile, at: number): number => f.text.slice(0, at).split('\n').length;

/** Every string, template and JSX text in a source file. */
function copyIn(f: SourceFile): Copy[] {
  const found = [...strip(f.text).literals, ...(f.rel.endsWith('.tsx') ? findJsxText(f.text) : [])];
  return found.map((l) => ({ where: `${f.rel}:${lineOf(f, l.start)}`, text: l.text }));
}

/**
 * Literals that read as words, not as class names, selectors or ids: they
 * hold a capital letter, or several words without code punctuation.
 */
const readsAsWords = (text: string): boolean =>
  /[A-Za-z]{2}/.test(text) && (/[A-Z]/.test(text) || (/\s/.test(text) && !/[-_.#[\]/=]/.test(text)));

/** `content: '…'` strings in the style sheets. */
function cssContent(): Copy[] {
  const out: Copy[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.css')) {
        const css = readFileSync(full, 'utf8');
        for (const m of css.matchAll(/content:\s*(['"])(.*?)\1/g)) out.push({ where: full.slice(ROOT.length + 1), text: m[2] });
      }
    }
  };
  walk(SRC);
  return out;
}

/** Visible text of index.html (tags stripped). */
function htmlText(): Copy[] {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8').replace(/<!DOCTYPE[^>]*>/i, '');
  return [{ where: 'index.html', text: html.replace(/<[^>]*>/g, ' ') }];
}

describe('no exclamation marks anywhere (UX-DR42)', () => {
  it('no string, template or JSX text in src/ has one', () => {
    const hits = sources.flatMap(copyIn).filter((c) => c.text.includes('!'));
    expect(hits.map((c) => `${c.where} ${c.text}`)).toEqual([]);
  });

  it('nor does any CSS content string or the page itself', () => {
    const hits = [...cssContent(), ...htmlText()].filter((c) => c.text.includes('!'));
    expect(hits.map((c) => `${c.where} ${c.text}`)).toEqual([]);
  });

  it('the scan sees literals, templates and JSX text', () => {
    const fake: SourceFile = {
      rel: 'ui/fake.tsx',
      text: "const a = 'ONE!';\nconst b = `TWO ${a}!`;\nconst c = <p>THREE!</p>;\n// comment!\n",
    };
    expect(copyIn(fake).filter((c) => c.text.includes('!')).map((c) => c.where)).toEqual([
      'ui/fake.tsx:1',
      'ui/fake.tsx:2',
      'ui/fake.tsx:3',
    ]);
  });
});

describe('interface copy is plain', () => {
  it('no copy cheers or says "insufficient"', () => {
    const hits = sources.flatMap(copyIn).filter((c) => readsAsWords(c.text) && NOT_PLAIN.test(c.text));
    expect(hits.map((c) => `${c.where} ${c.text}`)).toEqual([]);
  });
});

describe('colony lines: short, upper case, present tense', () => {
  const lines = Object.entries(COLONY_LINES);

  it('every colony line keeps the colony voice', () => {
    expect(lines.length).toBeGreaterThan(0);
    const bad = lines.flatMap(([id, l]) => {
      // A template reads with its placeholders filled by an upper-case word.
      const problem = colonyVoiceProblem(l.text.replace(/\{\w+\}/g, 'X'));
      return problem ? [`${id}: "${l.text}" ${problem}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it('every phase reveal line keeps the colony voice', () => {
    const bad = PHASE_ORDER.flatMap((p) => {
      const problem = colonyVoiceProblem(REVEAL_LINES[p]);
      return problem ? [`${p}: "${REVEAL_LINES[p]}" ${problem}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it('every battle cause line keeps the colony voice (Story 4.3)', () => {
    const traits = Object.keys(TRAITS) as (keyof typeof TRAITS)[];
    const upgrades = [undefined, ...Object.keys(CAUSE_UPGRADE_WORDS)];
    const bad = traits.flatMap((trait) =>
      [...WIN_CAUSES, ...LOSS_CAUSES].flatMap((kind) =>
        upgrades.flatMap((upgrade) => {
          const line = causeLine({ kind, trait, upgrade });
          const problem = colonyVoiceProblem(line);
          return problem ? [`${kind}/${trait}/${upgrade}: "${line}" ${problem}`] : [];
        }),
      ),
    );
    expect(bad).toEqual([]);
  });

  it('every narrative beat keeps the colony voice (Story 4.9)', () => {
    const bad = MVP_PHASES.flatMap((p) =>
      (['entry', 'nearGoal'] as const).flatMap((k) => {
        const problem = colonyVoiceProblem(NARRATIVE_BEATS[p][k].text);
        return problem ? [`${p}.${k}: "${NARRATIVE_BEATS[p][k].text}" ${problem}`] : [];
      }),
    );
    expect(bad).toEqual([]);
  });

  it('the voice check catches what it should', () => {
    expect(colonyVoiceProblem('THE FIRST WORKER STIRS.')).toBeNull();
    expect(colonyVoiceProblem('The first worker stirs.')).not.toBeNull();
    expect(colonyVoiceProblem('THE FIRST WORKER STIRS!')).not.toBeNull();
    expect(colonyVoiceProblem('THE FIRST WORKER STIRS')).not.toBeNull();
    expect(colonyVoiceProblem('THE FIRST WORKER WAS BORN.')).not.toBeNull();
    expect(colonyVoiceProblem('⚔️ THE FIRST WORKER STIRS.')).not.toBeNull();
  });
});

describe('event names', () => {
  it('every decision title is upper case and ends with a full stop (OVERCROWDING.)', () => {
    for (const d of DECISIONS) {
      expect(d.title, d.id).toBe(d.title.toUpperCase());
      expect(d.title.endsWith('.'), d.id).toBe(true);
    }
    expect(DECISIONS.find((d) => d.id === 'overcrowding')!.title).toBe('OVERCROWDING.');
  });

  it("a costly timeout's line and toast keep the colony voice", () => {
    for (const d of DECISIONS) expect(colonyVoiceProblem(timeoutLine(d)), d.id).toBeNull();
  });
});

describe('no copy names a phase the player has not entered', () => {
  /** [where, text, first phase it can show in]. */
  const scoped: [string, string, Phase][] = [
    ...Object.entries(COLONY_LINES).map(([id, l]): [string, string, Phase] => [`COLONY_LINES.${id}`, l.text, l.from]),
    ...PHASE_ORDER.map((p): [string, string, Phase] => [`REVEAL_LINES.${p}`, REVEAL_LINES[p], p]),
    ...MVP_PHASES.flatMap((p) =>
      (['entry', 'nearGoal'] as const).map((k): [string, string, Phase] => [`NARRATIVE_BEATS.${p}.${k}`, NARRATIVE_BEATS[p][k].text, NARRATIVE_BEATS[p][k].from]),
    ),
    ...PHASE_ORDER.map((p): [string, string, Phase] => [`PHASE_TITLES.${p}`, PHASE_TITLES[p], p]),
    ...DECISIONS.flatMap((d) => {
      const from = PHASE_ORDER.find((p) => d.phases.includes(p))!;
      const texts = [d.title, d.situation, d.ignoreLine, ...d.choices.flatMap((c) => [c.label, c.costLine])];
      return texts.map((t): [string, string, Phase] => [`decision ${d.id}`, t, from]);
    }),
    ...TABS.flatMap((t) => [t.label, t.railLabel, t.name, t.empty].map((s): [string, string, Phase] => [`tab ${t.id}`, s, t.unlockPhase])),
    ...SEGMENTS.map((s): [string, string, Phase] => [`segment ${s.id}`, s.label, s.unlockPhase]),
    // Enemy traits show on the enemy card, which opens in Combat (Story 4.1).
    ...Object.entries(TRAITS).flatMap(([id, t]) => [t.label, t.line].map((s): [string, string, Phase] => [`trait ${id}`, s, Phase.COMBAT])),
    // Automation target rows (Story 4.10) show from the verb's own phase.
    ...AUTOMATION_VERBS.flatMap((v) => [v.keep, v.one, v.many].map((s): [string, string, Phase] => [`automation ${v.id}`, s, v.introducedIn])),
    // The lay row's warn text can show from Egg Laying.
    ...Object.entries(AUTOMATION_BLOCK_TEXT).map(([id, s]): [string, string, Phase] => [`automation block ${id}`, s, Phase.EGG_LAYING]),
    ...ROLES.flatMap((r) => [r.label, r.worker, r.effect].map((s): [string, string, Phase] => [`role ${r.id}`, s, r.unlockPhase])),
    ...RESOURCES.flatMap((r) => [r.label, r.name, r.source].map((s): [string, string, Phase] => [`resource ${r.id}`, s, r.unlockPhase])),
    ...TRANSITIONS.flatMap((t) =>
      t.conditions.flatMap((c) => [c.label, c.one ?? ''].map((s): [string, string, Phase] => [`goal ${t.from}.${c.id}`, s, t.from])),
    ),
  ];

  it('content tied to a phase names no phase after it', () => {
    const bad = scoped.flatMap(([where, text, from]) => {
      const later = namesLaterPhase(text, from);
      return later ? [`${where}: "${text}" (shown from ${from}) names ${later}`] : [];
    });
    expect(bad).toEqual([]);
  });

  /**
   * Copy that can show in any phase, Phase 1 included: the shell, the sheets,
   * the overlays, the NEST tab and the shared primitives.
   */
  const EVERY_PHASE = /^ui\/(shell|sheets|overlays|nest|primitives)\/|^ui\/App\.tsx?$|^ui\/scene\/Title|^data\/content\/titleCinematic\.ts$/;

  it('copy shown from Phase 1 names no later phase', () => {
    const titles = new Set(Object.values(PHASE_TITLES));
    const bad = sources
      .filter((f) => EVERY_PHASE.test(f.rel))
      .flatMap(copyIn)
      .filter((c) => readsAsWords(c.text) && !titles.has(c.text))
      .flatMap((c) => {
        const later = namesLaterPhase(c.text, Phase.EGG_LAYING);
        return later ? [`${c.where} "${c.text}" names ${later}`] : [];
      });
    expect(bad).toEqual([]);
  });

  it('the phase-name check catches what it should', () => {
    expect(namesLaterPhase('THE COLONY STOPPED.', Phase.EGG_LAYING)).toBe(Phase.COLONY);
    expect(namesLaterPhase('THE COLONY STOPPED.', Phase.COLONY)).toBeNull();
    expect(namesLaterPhase('Only transcendence can help.', Phase.SPACE)).toBe(Phase.TRANSCENDENCE);
    expect(namesLaterPhase('PRIMARY ACTION: SPACE', Phase.EGG_LAYING)).toBeNull();
  });
});
