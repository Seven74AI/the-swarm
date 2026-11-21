/**
 * Source scanner for the architecture boundary test (AR21).
 *
 * No parser dependency: a small lexer blanks comments and string/template
 * text (keeping newlines, so line numbers stay right), then plain regexes
 * look for imports and forbidden identifiers in what is left.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export interface Stripped {
  /** Comments blanked; string literals kept (import specifiers live there). */
  noComments: string;
  /** Comments and the text of every string/template literal blanked; `${}` code kept. */
  code: string;
  /**
   * Every string and template literal, in source order of its end. A template's
   * `${…}` parts read as `{}`; escapes are kept as written.
   */
  literals: Literal[];
}

export interface Literal {
  /** Index of the opening quote or backtick. */
  start: number;
  text: string;
}

const REGEX_PREFIX_KEYWORDS = /\b(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

/** Blank comments and literal text, character for character (newlines survive). */
export function strip(src: string): Stripped {
  const noComments: string[] = [];
  const code: string[] = [];
  const blank = (ch: string): string => (ch === '\n' ? '\n' : ' ');
  // Stack of brace depths for `${ ... }` inside template literals.
  const templateDepths: number[] = [];
  let braceDepth = 0;
  let lastSignificant = '';
  let i = 0;
  const literals: Literal[] = [];
  // Open template literals (nested ones live inside `${}` of an outer one).
  const templates: Literal[] = [];

  const emit = (ch: string, keepInNoComments: boolean, keepInCode: boolean): void => {
    noComments.push(keepInNoComments ? ch : blank(ch));
    code.push(keepInCode ? ch : blank(ch));
  };

  const readString = (quote: string): void => {
    const start = i;
    emit(src[i], true, true); // opening quote
    i++;
    while (i < src.length && src[i] !== quote && src[i] !== '\n') {
      if (src[i] === '\\' && i + 1 < src.length) {
        emit(src[i], true, false);
        i++;
      }
      emit(src[i], true, false);
      i++;
    }
    literals.push({ start, text: src.slice(start + 1, i) });
    if (i < src.length) {
      emit(src[i], true, true); // closing quote
      i++;
    }
  };

  // Reads template text up to the closing backtick or a `${`.
  const readTemplateText = (): void => {
    const current = templates[templates.length - 1];
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\\' && i + 1 < src.length) {
        current.text += src.slice(i, i + 2);
        emit(ch, true, false);
        emit(src[i + 1], true, false);
        i += 2;
        continue;
      }
      if (ch === '`') {
        literals.push(templates.pop()!);
        emit(ch, true, true);
        i++;
        lastSignificant = '`';
        return;
      }
      if (ch === '$' && src[i + 1] === '{') {
        current.text += '{}';
        emit('$', true, true);
        emit('{', true, true);
        i += 2;
        templateDepths.push(braceDepth);
        braceDepth++;
        lastSignificant = '{';
        return;
      }
      current.text += ch;
      emit(ch, true, false);
      i++;
    }
    // Unterminated template: keep what was read.
    if (templates.length > 0 && templates[templates.length - 1] === current) literals.push(templates.pop()!);
  };

  const regexMayStart = (): boolean => {
    if (lastSignificant === '') return true;
    if ('(,=:[!&|?{};+-*%<>~^'.includes(lastSignificant)) return true;
    const before = code.join('').trimEnd();
    return REGEX_PREFIX_KEYWORDS.test(before);
  };

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        emit(src[i], false, false);
        i++;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      while (i < stop) {
        emit(src[i], false, false);
        i++;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      readString(ch);
      lastSignificant = ch;
      continue;
    }
    if (ch === '`') {
      templates.push({ start: i, text: '' });
      emit(ch, true, true);
      i++;
      readTemplateText();
      continue;
    }
    if (ch === '/' && regexMayStart()) {
      // Regex literal: blank its body in `code` so quotes inside it do no harm.
      emit(ch, true, true);
      i++;
      let inClass = false;
      while (i < src.length && src[i] !== '\n') {
        const c = src[i];
        if (c === '\\' && i + 1 < src.length) {
          emit(c, true, false);
          emit(src[i + 1], true, false);
          i += 2;
          continue;
        }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
        emit(c, true, false);
        i++;
      }
      if (i < src.length && src[i] === '/') {
        emit('/', true, true);
        i++;
      }
      lastSignificant = '/regex';
      continue;
    }
    if (ch === '{') braceDepth++;
    if (ch === '}') {
      braceDepth--;
      if (templateDepths.length > 0 && templateDepths[templateDepths.length - 1] === braceDepth) {
        templateDepths.pop();
        emit(ch, true, true);
        i++;
        readTemplateText();
        continue;
      }
    }
    emit(ch, true, true);
    if (!/\s/.test(ch)) lastSignificant = ch;
    i++;
  }

  literals.sort((a, b) => a.start - b.start);
  return { noComments: noComments.join(''), code: code.join(''), literals };
}

export interface ImportRef {
  specifier: string;
  /** True when only types are imported (`import type`, or every named binding marked `type`). */
  typeOnly: boolean;
  line: number;
}

const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length;

function clauseIsTypeOnly(clause: string): boolean {
  const trimmed = clause.trim();
  const brace = /^\{([\s\S]*)\}$/.exec(trimmed);
  if (!brace) return false; // default or namespace binding, or `export *`
  const names = brace[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return names.length > 0 && names.every((n) => /^type\s/.test(n));
}

/** Every static, side-effect, re-export and dynamic import in a file. */
export function findImports(src: string): ImportRef[] {
  const { noComments, code } = strip(src);
  const refs: ImportRef[] = [];
  const keyword = /(?<![\w$.])(import|export)\b/g;
  let m: RegExpExecArray | null;
  while ((m = keyword.exec(code)) !== null) {
    const at = m.index;
    const fromForm = /(import|export)\s+(type\s+)?([\w$*,\s{}]*?)\s*from\s*(['"])([^'"\n]+)\4/y;
    fromForm.lastIndex = at;
    const f = fromForm.exec(noComments);
    if (f && !/\b(import|export)\b/.test(f[3])) {
      refs.push({ specifier: f[5], typeOnly: Boolean(f[2]) || clauseIsTypeOnly(f[3]), line: lineAt(src, at) });
      continue;
    }
    const sideEffect = /import\s*(['"])([^'"\n]+)\1/y;
    sideEffect.lastIndex = at;
    const s = sideEffect.exec(noComments);
    if (s) {
      refs.push({ specifier: s[2], typeOnly: false, line: lineAt(src, at) });
      continue;
    }
    const dynamic = /import\s*\(\s*(['"])([^'"\n]+)\1/y;
    dynamic.lastIndex = at;
    const d = dynamic.exec(noComments);
    if (d) {
      refs.push({ specifier: d[2], typeOnly: false, line: lineAt(src, at) });
      continue;
    }
    // `import("x")` type positions: `typeof import('x')` / `import('x').T` in types.
  }
  return refs;
}

export interface Hit {
  line: number;
  text: string;
}

/** Matches of `pattern` (needs the `g` flag) in code, with comments and strings blanked. */
export function findInCode(src: string, pattern: RegExp): Hit[] {
  const { code } = strip(src);
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(code)) !== null) {
    hits.push({ line: lineAt(code, m.index), text: m[0] });
    if (m[0].length === 0) pattern.lastIndex++;
  }
  return hits;
}

/** Browser globals the game layers must not touch (they run in Node). */
export const DOM_GLOBALS = [
  'document',
  'window',
  'localStorage',
  'sessionStorage',
  'navigator',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'customElements',
  'getComputedStyle',
  'matchMedia',
  'DOMParser',
  'MutationObserver',
  'IntersectionObserver',
  'ResizeObserver',
  'AudioContext',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'TouchEvent',
];

export const DOM_PATTERN = new RegExp(
  `(?<![\\w$.])(?:${DOM_GLOBALS.join('|')}|HTML\\w*Element|SVG\\w*Element)\\b`,
  'g',
);
export const MATH_RANDOM_PATTERN = /(?<![\w$.])Math\s*(?:\?\.|\.)\s*random\b/g;
export const GAME_STATE_READ_PATTERN = /(?<![\w$.])gameState\s*(?:\?\.|\.)\s*(?:value\b|peek\s*\()/g;
const ASSIGN_OP = String.raw`(?:\*\*=|>>>=|<<=|>>=|&&=|\|\|=|\?\?=|[-+*/%&|^]=|=(?![=>])|\+\+|--)`;
const MEMBER_CHAIN = String.raw`(?:\s*(?:\?\.|\.)\s*[\w$]+|\s*\[[^\]\n]*\])*`;
export const GAME_STATE_WRITE_PATTERN = new RegExp(
  String.raw`(?:(?:\+\+|--)\s*gameState\s*\.\s*value\b${MEMBER_CHAIN}` +
    String.raw`|(?<![\w$.])gameState\s*\.\s*value\b${MEMBER_CHAIN}\s*${ASSIGN_OP}` +
    String.raw`|Object\s*\.\s*assign\s*\(\s*gameState\s*\.\s*value\b)`,
  'g',
);

export interface SourceFile {
  /** Path relative to `src/`, with forward slashes (e.g. `systems/BattleSystem.ts`). */
  rel: string;
  text: string;
}

export function listSources(srcRoot: string): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mts|mjs)$/.test(name)) {
        out.push({ rel: relative(srcRoot, full).split(sep).join('/'), text: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(srcRoot);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Top-level layer of a src-relative path: its first folder, or the file's
 * base name for root files (`main.ts` → `main`).
 */
export function layerOf(rel: string): string {
  const [first, ...rest] = rel.split('/');
  if (rest.length > 0) return first;
  return first.replace(/(\.d)?\.[mc]?[jt]sx?$/, '');
}

/**
 * Src-relative target of a relative import, or null for packages and
 * targets outside `src/`.
 */
export function resolveInSrc(fromRel: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const root = resolve('/__src__');
  const target = resolve(root, dirname(fromRel), specifier);
  if (target !== root && !target.startsWith(root + sep)) return null;
  return relative(root, target).split(sep).join('/');
}

export interface CallArgs {
  /** Line of the call's opening parenthesis. */
  line: number;
  /** Source text (comments blanked, strings kept) between the call's parentheses. */
  args: string;
}

/**
 * Argument text of every call matched by `callee` (needs the `g` flag and
 * must end at the opening parenthesis), found by balancing parentheses in
 * code with comments and strings blanked.
 */
export function findCallArguments(src: string, callee: RegExp): CallArgs[] {
  const { code, noComments } = strip(src);
  const out: CallArgs[] = [];
  let m: RegExpExecArray | null;
  callee.lastIndex = 0;
  while ((m = callee.exec(code)) !== null) {
    const open = m.index + m[0].length - 1;
    if (code[open] !== '(') continue;
    let depth = 0;
    let end = open;
    for (; end < code.length; end++) {
      if (code[end] === '(') depth++;
      else if (code[end] === ')' && --depth === 0) break;
    }
    out.push({ line: lineAt(code, open), args: noComments.slice(open + 1, end) });
  }
  return out;
}

/**
 * Writes of a `phase` field (Story 1.19, AR23): a member assignment
 * (`x.phase = …`, `x['phase'] = …` is not detected since string text is
 * blanked; `dataset.phase` is skipped) or an object literal that rebuilds a state, meaning it has both a
 * spread (`...s`) and a `phase` key (`phase: …` or shorthand `phase`) at its
 * own top level. Event payloads and type literals have no spread, so they
 * don't count.
 */
export function findPhaseWrites(src: string): Hit[] {
  const { code } = strip(src);
  const hits: Hit[] = [];
  // `el.dataset.phase = …` is a DOM attribute (the phase palette), not game state.
  const member = /(?<!\bdataset\s*)(?:\.|\?\.)\s*phase\s*=(?![=>])/g;
  let m: RegExpExecArray | null;
  while ((m = member.exec(code)) !== null) hits.push({ line: lineAt(code, m.index), text: m[0] });

  const stack: number[] = [];
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') stack.push(i);
    else if (ch === '}' && stack.length > 0) {
      const open = stack.pop()!;
      // Keep only this literal's own top level: blank nested braces, brackets and parens.
      let depth = 0;
      let top = '';
      for (let j = open + 1; j < i; j++) {
        const c = code[j];
        if (c === '{' || c === '[' || c === '(') depth++;
        else if (c === '}' || c === ']' || c === ')') depth--;
        else top += depth === 0 ? c : ' ';
      }
      const hasSpread = /(?:^|,)\s*\.\.\./.test(top);
      const key = /(?:^|,)\s*phase\s*(?::|,|$)/.exec(top);
      if (hasSpread && key) hits.push({ line: lineAt(code, open), text: `{ …, phase }` });
    }
  }
  return hits.sort((a, b) => a.line - b.line);
}

/**
 * Text children of JSX elements in a `.tsx` file (`<p>HELLO</p>` → `HELLO`),
 * found between a tag's `>` and the next `<` or `{` in code with comments and
 * strings blanked. Runs that look like code (`;`, `=`, parentheses, `&&`, `||`)
 * are skipped, so generics and comparisons don't count.
 */
export function findJsxText(src: string): Literal[] {
  const { code } = strip(src);
  const out: Literal[] = [];
  const run = />([^<>{}]*)(?=[<{])/g;
  let m: RegExpExecArray | null;
  while ((m = run.exec(code)) !== null) {
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z]/.test(text) || /[;=()]|&&|\|\|/.test(m[1])) continue;
    out.push({ start: m.index + 1, text });
  }
  return out;
}
