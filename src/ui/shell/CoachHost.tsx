import { signal, type ReadonlySignal } from '@preact/signals';
import { CoachMark, type CoachMarkMemory } from '../primitives/CoachMark';

/**
 * `ui/shell/CoachHost` (Story 8.10): draws the one coach mark main asks for
 * (UX-DR29), above the shell. The first is LAY EGG, once the queen wakes from
 * the title cinematic. The target is found by selector when the mark is asked
 * for; a missing target, or a concept already seen (settings `coachMarksSeen`),
 * draws nothing.
 */

export interface CoachRequest {
  readonly concept: string;
  readonly text: string;
  /** A selector for the element whose action the mark points to (`#click-egg`). */
  readonly target: string;
}

export interface Coach {
  readonly mark: ReadonlySignal<CoachRequest | null>;
  show(request: CoachRequest): void;
}

export function createCoach(): Coach {
  const mark = signal<CoachRequest | null>(null);
  return {
    mark,
    show(request) {
      mark.value = request;
    },
  };
}

export function CoachHost({ coach, memory }: { coach: Coach; memory: CoachMarkMemory }) {
  const req = coach.mark.value;
  if (!req) return null;
  const target = document.querySelector<HTMLElement>(req.target);
  if (!target) return null;
  return <CoachMark key={req.concept} concept={req.concept} text={req.text} target={target} memory={memory} />;
}
