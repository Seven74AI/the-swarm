/**
 * Coach mark primitive (Story 1.12, UX-DR29).
 *
 * One element, one short line, once per concept. A 1 px `accent` box around the
 * target plus a caption on `raised` with `[ GOT IT ]` (it wraps, never clips: #490). It is
 * dismissed by performing the action it points to (a click on the target,
 * which still runs that action) or by `[ GOT IT ]`, whose tap is consumed:
 * nothing under or around it sees it. The caption is announced politely.
 *
 * "Seen" is remembered in settings (`coachMarksSeen`), never in the game save.
 * The settings store reaches the UI from main (ADR 0007): pass it as `memory`.
 */
import './CoachMark.css';
import { useEffect, useState } from 'preact/hooks';
import type { ReadonlySignal } from '@preact/signals';
import type { Settings } from '../../platform/settings';

/** The slice of the settings store a coach mark needs; `platform.settings` fits. */
export interface CoachMarkMemory {
  readonly settings: ReadonlySignal<Pick<Settings, 'coachMarksSeen'>>;
  update(patch: Pick<Settings, 'coachMarksSeen'>): void;
}

export interface CoachMarkProps {
  /** Stable concept id, e.g. `lay-egg`. Each concept is coached once, ever. */
  readonly concept: string;
  /** One line. */
  readonly text: string;
  /** The element whose action the mark points to. */
  readonly target: HTMLElement | null;
  readonly memory: CoachMarkMemory;
}

interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

function boxOf(el: HTMLElement | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Below the target, or above it when the target is in the lower half (a primary action), so it stays on screen. */
function captionPlace(box: Box | null): Record<string, string> | undefined {
  if (!box) return undefined;
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight;
  if (vh > 0 && box.top + box.height / 2 > vh / 2) return { bottom: `${vh - box.top + 8}px` };
  return { top: `${box.top + box.height + 8}px` };
}

function markSeen(memory: CoachMarkMemory, concept: string): void {
  const seen = memory.settings.value.coachMarksSeen;
  if (seen.includes(concept)) return;
  memory.update({ coachMarksSeen: [...seen, concept] });
}

export function CoachMark({ concept, text, target, memory }: CoachMarkProps) {
  const seen = memory.settings.value.coachMarksSeen.includes(concept);
  const [box, setBox] = useState<Box | null>(() => boxOf(target));

  useEffect(() => {
    if (seen || !target) return;
    const onAction = () => markSeen(memory, concept);
    const place = () => setBox(boxOf(target));
    place();
    target.addEventListener('click', onAction);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      target.removeEventListener('click', onAction);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [seen, target, memory, concept]);

  if (seen) return null;

  const consume = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const gotIt = (e: Event) => {
    consume(e);
    markSeen(memory, concept);
  };
  const caption = text.replace(/\s*\n\s*/g, ' ').trim();

  return (
    <div class="coach-mark" data-coach-mark={concept}>
      {box && (
        <div
          class="coach-mark__box"
          aria-hidden="true"
          style={{ top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px` }}
        />
      )}
      <div
        class="coach-mark__caption"
        style={captionPlace(box)}
        onPointerDown={consume}
      >
        <p class="coach-mark__text" role="status" aria-live="polite">
          {caption}
        </p>
        <button type="button" class="coach-mark__got-it" data-action="coach-got-it" onClick={gotIt}>
          <span aria-hidden="true">[ </span>GOT IT<span aria-hidden="true"> ]</span>
        </button>
      </div>
    </div>
  );
}
