// @vitest-environment node
/**
 * Story 8.2 (NFR11, UX-DR35): no emoji anywhere in src/, placeholders
 * included. Icons are the line glyphs of `src/ui/glyphs/`; everything else is
 * typed text. The scan reads EVERY file under src/ (code, comments, strings,
 * stylesheets), so a pictograph can't hide in a comment or a CSS `content:`.
 *
 * An emoji code point is any pictograph (`Extended_Pictographic`, which also
 * covers text-default ones such as the gear or the pause sign), anything shown
 * as emoji by default (`Emoji_Presentation`), a regional-indicator flag half,
 * a skin-tone modifier, a keycap combiner, a zero-width joiner, or a
 * presentation selector (U+FE0E/U+FE0F, which only make sense after an emoji).
 * Typed geometric characters the terminal uses (`·`, `→`, `▲`, `▸`, `△`) are
 * not emoji and stay allowed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

const EMOJI =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\u{20E3}|\u{200D}|\u{FE0E}|\u{FE0F}/gu;

interface TextFile {
  readonly rel: string;
  readonly text: string;
}

function allFiles(dir: string, root = dir): TextFile[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return allFiles(full, root);
    return [{ rel: relative(root, full).split(sep).join('/'), text: readFileSync(full, 'utf8') }];
  });
}

const hex = (c: string) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

/** `file:line has U+1F41C` for every emoji code point in the files. */
export function emojiHits(files: readonly TextFile[]): string[] {
  return files.flatMap((f) =>
    f.text.split('\n').flatMap((line, i) => {
      const found = line.match(EMOJI);
      return found ? [`${f.rel}:${i + 1} has ${found.map(hex).join(' ')}`] : [];
    }),
  );
}

describe('no emoji in src/ (Story 8.2, NFR11)', () => {
  it('no file under src/ contains an emoji code point, comments and placeholders included', () => {
    const files = allFiles(SRC);
    expect(files.length).toBeGreaterThan(0);
    expect(emojiHits(files)).toEqual([]);
  });

  it('catches planted emoji, text-presentation ones included, but not the typed terminal glyphs', () => {
    const fake = (rel: string, text: string): TextFile => ({ rel, text });
    const hits = emojiHits([
      fake('ui/A.tsx', "<span aria-hidden=\"true\">\u{1F41C} </span>"),
      fake('ui/B.ts', "export const GEAR = '⚙︎';"),
      fake('ui/C.ts', '// pause ⏸ in a comment'),
      fake('ui/D.css', ".x::before { content: '✨'; }"),
      fake('data/E.ts', "icon: '\u{1F1FA}\u{1F1F8}'"),
      fake('ui/F.ts', "const line = 'LV.2 → 3 · needs 60 more △ ▲ ▸ ‖ ▷';"),
    ]);
    expect(hits.map((h) => h.split(' ')[0])).toEqual(['ui/A.tsx:1', 'ui/B.ts:1', 'ui/C.ts:1', 'ui/D.css:1', 'data/E.ts:1']);
  });
});
