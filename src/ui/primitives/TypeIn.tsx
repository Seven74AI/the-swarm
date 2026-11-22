import type { ComponentChildren } from 'preact';
import { feelBalance } from '../../data/balance/feel';
import './TypeIn.css';

/**
 * Typed-in text (Story 8.9, UX-DR37): a headline or a `+N` appears one
 * character at a time, like a terminal printing it.
 *
 * The whole text is in the DOM from the first frame, so assistive tech reads
 * it at once and focus on a headline names it whole. Only the drawing is
 * revealed, by a CSS clip in `steps()` of one character (TypeIn.css). Under
 * reduced motion there is no animation: the text is simply there.
 *
 * Hook: `[data-type-in]`.
 */

/** How long `text` takes to type in: one step per character, capped. */
export function typeInMs(text: string): number {
  return Math.min(feelBalance.typeInMaxMs, Math.max(1, text.length) * feelBalance.typeInCharMs);
}

export function TypeIn({ text, children }: { text: string; children?: ComponentChildren }) {
  const chars = Math.max(1, text.length);
  return (
    <span class="type-in" data-type-in="" style={{ '--type-in-chars': String(chars), '--type-in-ms': `${typeInMs(text)}ms` }}>
      {children ?? text}
    </span>
  );
}
