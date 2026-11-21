/**
 * The line-glyph frame (Story 8.2, UX-DR35; ADR 0039).
 *
 * Every glyph is a 24×24 grid drawn with a 1.6 px round-capped stroke in
 * `currentColor`, so it takes the phase colour like the text around it. A
 * glyph is decoration: it is `aria-hidden`, never focusable, and always sits
 * next to a text label (or a `.visually-hidden` name) that carries its meaning.
 * Its size follows the text it sits in (`1em`); the places that use a set size
 * (strip, cost lines, cards, resource sheet) set `--glyph-size` in rem.
 */
import './glyphs.css';
import type { ComponentChildren, FunctionComponent } from 'preact';

export interface GlyphProps {
  /** Extra classes (the caller's hook). */
  readonly class?: string;
}

/** A `Glyph<Name>` component. */
export type Glyph = FunctionComponent<GlyphProps>;

export function GlyphFrame({ class: extra, children }: GlyphProps & { children: ComponentChildren }) {
  return (
    <svg
      class={extra ? `glyph ${extra}` : 'glyph'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
