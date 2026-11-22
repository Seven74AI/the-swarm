/**
 * THE SWARM's block logo (Story 8.10; `mockups/title-cinematic.html`): the
 * terminal's block cells (`█`) spelling SWARM, five rows high. It is drawn as
 * cells, not typed, so it fits any screen and text size without reflowing
 * into nonsense; the heading it sits in carries the words for assistive tech.
 * Drawn in `currentColor`; as line-work it takes the CRT glow (Story 8.4).
 * Hooks: `[data-logo="swarm"]`.
 */

const LETTERS: Readonly<Record<string, readonly string[]>> = {
  S: [' ####', '#    ', ' ### ', '    #', '#### '],
  W: ['#   #', '#   #', '# # #', '# # #', ' # # '],
  A: [' ### ', '#   #', '#####', '#   #', '#   #'],
  R: ['#### ', '#   #', '#### ', '#  # ', '#   #'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
};

const ROWS = [0, 1, 2, 3, 4].map((r) =>
  'SWARM'
    .split('')
    .map((c) => LETTERS[c][r])
    .join(' '),
);
const COLS = ROWS[0].length;
/** A cell is a character cell of the grid: taller than wide. */
const CW = 6;
const CH = 10;

const CELLS: readonly (readonly [number, number])[] = ROWS.flatMap((row, y) =>
  [...row].flatMap((c, x) => (c === '#' ? [[x, y] as const] : [])),
);

export function TitleLogo({ class: extra }: { readonly class?: string }) {
  return (
    <svg
      class={extra ? `title-logo ${extra}` : 'title-logo'}
      data-logo="swarm"
      data-line-work=""
      viewBox={`0 0 ${COLS * CW} ${ROWS.length * CH}`}
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      {CELLS.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x * CW} y={y * CH} width={CW} height={CH} />
      ))}
    </svg>
  );
}
