/**
 * Card primitive (Story 1.12, UX-DR17): building, research, mutation, enemy,
 * Click Power.
 *
 * Only the action slot is tappable: the card is a plain `article` with no
 * handler, role or tab stop. An unaffordable card shows its shortfall in
 * `warn` ("needs 60 more △"). The first time a card becomes affordable while
 * it is on screen, its border highlights in `accent` for 2 s; a card that is
 * already affordable when it mounts, or that becomes affordable again later,
 * does not highlight.
 */
import './Card.css';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatFull } from '../../utils/format';
import { decorate, Sep } from './Deco';

export const CARD_HIGHLIGHT_MS = 2000;

export interface Shortfall {
  /** How much more of the missing resource is needed (whole units). */
  readonly amount: number;
  /** The resource glyph, drawn inline after the amount. */
  readonly glyph?: ComponentChildren;
}

export interface CardProps {
  readonly title: ComponentChildren;
  readonly glyph?: ComponentChildren;
  /** Level change, e.g. "Lv 2 → 3". */
  readonly level?: ComponentChildren;
  readonly effect?: ComponentChildren;
  readonly cost?: ComponentChildren;
  readonly affordable: boolean;
  /** Shown only while unaffordable. */
  readonly shortfall?: Shortfall | null;
  /** The one tappable thing on the card (a Button). */
  readonly action: ComponentChildren;
  readonly selected?: boolean;
  /** Extra content under the cost line (a research progress meter). */
  readonly children?: ComponentChildren;
  /** Data hook for E2E, e.g. the building id. */
  readonly id?: string;
}

/** True for `CARD_HIGHLIGHT_MS` after `affordable` first turns true while mounted. */
function useFirstAffordableHighlight(affordable: boolean): boolean {
  const wasUnaffordable = useRef(!affordable);
  const done = useRef(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!affordable) {
      wasUnaffordable.current = true;
      return;
    }
    if (done.current || !wasUnaffordable.current) return;
    done.current = true;
    setOn(true);
    const t = setTimeout(() => setOn(false), CARD_HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [affordable]);
  return on;
}

export function Card(props: CardProps) {
  const { title, glyph, level, effect, cost, affordable, shortfall, action, selected, children, id } = props;
  const highlight = useFirstAffordableHighlight(affordable);
  const short = !affordable && shortfall ? Math.max(0, Math.floor(shortfall.amount)) : 0;
  return (
    <article
      class="card"
      data-card={id ?? ''}
      data-affordable={affordable ? '' : undefined}
      data-selected={selected ? '' : undefined}
      data-highlight={highlight ? '' : undefined}
    >
      <h3 class="card__title">
        {glyph && (
          <span class="card__glyph" aria-hidden="true">
            {glyph}
          </span>
        )}
        <span class="card__name">{title}</span>
        {level && <span class="card__level">{decorate(level)}</span>}
      </h3>
      {effect && <p class="card__effect">{decorate(effect)}</p>}
      {(cost || short > 0) && (
        <p class="card__cost">
          {decorate(cost)}
          {short > 0 && (
            <span class="card__shortfall" data-shortfall="">
              {cost ? <Sep /> : ''}needs {formatFull(short)} more
              {shortfall?.glyph && <> {shortfall.glyph}</>}
            </span>
          )}
        </p>
      )}
      {children}
      <div class="card__action">{action}</div>
    </article>
  );
}
