/**
 * The first enemy creature (Story 8.3, UX-DR27; DESIGN.md → Phase reveal).
 *
 * The Combat reveal is the first place an enemy is drawn: nothing before
 * Combat draws one (tests/e2e/palette.spec.ts). It is vector line-work, like
 * the rest of the world (DESIGN.md: "vector scene, terminal UI"): a hard-shelled
 * beetle seen from above, wider and heavier than an ant, with a split shell,
 * open mandibles, six jointed legs and short antennae. It is drawn in
 * `currentColor`, so it takes the phase accent and cross-fades with the
 * palette. It is decoration: the reveal's line names the threat in words.
 * Hooks: `[data-creature="enemy"]`.
 */
export function EnemyCreature({ class: extra }: { readonly class?: string }) {
  return (
    <svg
      class={extra ? `enemy-creature ${extra}` : 'enemy-creature'}
      data-creature="enemy"
      viewBox="0 0 96 64"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Shell: two wing cases meeting on the midline. */}
      <ellipse cx="54" cy="32" rx="24" ry="17" />
      <line x1="34" y1="32" x2="78" y2="32" />
      {/* Pronotum and head. */}
      <ellipse cx="27" cy="32" rx="7" ry="9" />
      <ellipse cx="16" cy="32" rx="5" ry="5.5" />
      {/* Mandibles, open. */}
      <path d="M12 28 Q6 24 4 28" />
      <path d="M12 36 Q6 40 4 36" />
      {/* Antennae. */}
      <path d="M14 27 Q10 18 4 16" />
      <path d="M14 37 Q10 46 4 48" />
      {/* Six legs, jointed. */}
      <polyline points="28,24 24,14 16,10" />
      <polyline points="28,40 24,50 16,54" />
      <polyline points="46,17 46,8 38,3" />
      <polyline points="46,47 46,56 38,61" />
      <polyline points="64,18 70,8 80,4" />
      <polyline points="64,46 70,56 80,60" />
    </svg>
  );
}
