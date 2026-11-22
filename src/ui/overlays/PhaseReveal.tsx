import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ReadonlySignal } from '@preact/signals';
import { Phase } from '../../phases/phases';
import type { EventBus } from '../../engine/EventBus';
import { REVEAL_LINES } from '../../data/content/phaseReveal';
import { PHASE_TITLES } from '../shell/GoalMeter';
import { PHASE_TOKEN } from '../theme/phaseTheme';
import type { OverlayController } from '../shell/OverlayController';
import { EnemyCreature } from '../scene/EnemyCreature';
import './PhaseReveal.css';

/**
 * The phase reveal (Story 1.20; UX-DR27, DESIGN.md → Phase reveal).
 *
 * Full screen, input-blocking, for at most `REVEAL_MS`: the palette cross-fades
 * from the old phase to the new one (PhaseReveal.css, keyed to
 * `:root[data-overlay-active="phase-reveal"]`), the phase name appears in `display`
 * and one event line types in. Then it ends by itself.
 * It can be skipped (a tap, Enter or Esc) only once the player has seen that
 * phase's reveal (`lifetime.revealsSeen`); the first time, every tap and key
 * is swallowed so nothing reaches the game behind it.
 * The Combat reveal also draws the first enemy creature (Story 8.3): no
 * screen before it draws one.
 * Hooks: `[data-overlay="phase-reveal"][data-phase-reveal=<token>][data-skippable]`,
 * `[data-reveal-name]`, `[data-reveal-line]`, `[data-reveal-skip]`, `[data-creature="enemy"]` (Combat).
 */

/** How long the reveal blocks input, at most (UX-DR27: ≤ 3.5 s). */
export const REVEAL_MS = 3500;
/** The line starts typing once the name has appeared… */
export const TYPE_START_MS = 800;
/** …and is fully typed this long after. */
export const TYPE_MS = 1600;

const SKIP_KEYS = new Set(['Enter', 'Escape']);

interface PhaseRevealProps {
  phase: Phase;
  /** True once this phase's reveal has been seen. */
  skippable: boolean;
  /** Under reduced motion the line appears whole (the cross-fade is 300 ms, in CSS). */
  reducedMotion: boolean;
  done: () => void;
}

export function PhaseReveal({ phase, skippable, reducedMotion, done }: PhaseRevealProps) {
  const root = useRef<HTMLDivElement>(null);
  const ended = useRef(false);
  const line = REVEAL_LINES[phase] ?? '';
  const [typed, setTyped] = useState(reducedMotion ? line.length : 0);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    done();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useLayoutEffect(() => {
    root.current?.focus();
  }, []);

  // Ends by itself.
  useEffect(() => {
    const t = setTimeout(() => finishRef.current(), REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  // Types the line in, one character at a time.
  useEffect(() => {
    if (reducedMotion || line.length === 0) return;
    const step = Math.max(1, Math.floor(TYPE_MS / line.length));
    let n = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        n += 1;
        setTyped(n);
        if (n >= line.length && interval !== undefined) clearInterval(interval);
      }, step);
    }, TYPE_START_MS);
    return () => {
      clearTimeout(start);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [line, reducedMotion]);

  // Blocks every key from reaching the game; Enter / Esc skip once seen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (skippable && SKIP_KEYS.has(e.key)) finishRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [skippable]);

  const token = PHASE_TOKEN[phase] ?? PHASE_TOKEN[Phase.EGG_LAYING];
  const nameId = `phase-reveal-name-${token}`;
  return (
    <div
      ref={root}
      class="phase-reveal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={nameId}
      aria-describedby={`${nameId}-line`}
      tabIndex={-1}
      data-overlay="phase-reveal"
      data-phase-reveal={token}
      data-skippable={skippable ? 'true' : 'false'}
      onPointerDown={(e) => {
        e.preventDefault();
        if (skippable) finish();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {phase === Phase.COMBAT && <EnemyCreature class="phase-reveal__creature" />}
      <h1 id={nameId} class="phase-reveal__name" data-reveal-name="" data-display="">
        {(PHASE_TITLES[phase] ?? '').toUpperCase()}
      </h1>
      {/* Typing is visual only (UX-DR40): assistive tech gets the whole line from the start. */}
      <p id={`${nameId}-line`} class="phase-reveal__line" data-reveal-line="">
        <span aria-hidden="true" data-reveal-typed="">
          {line.slice(0, typed)}
        </span>
        <span class="visually-hidden">{line}</span>
      </p>
      {skippable && (
        <p class="phase-reveal__skip" data-reveal-skip="" aria-hidden="true">
          TAP TO SKIP
        </p>
      )}
    </div>
  );
}

export interface PhaseRevealDeps {
  bus: EventBus;
  overlays: OverlayController;
  /** The phases whose reveal has been seen (`lifetime.revealsSeen`), read when a reveal starts. */
  revealsSeen: () => readonly string[];
  /** Records that a phase's reveal has been seen (the `markRevealSeen` action). */
  markSeen: (phase: Phase) => unknown;
  reducedMotion: ReadonlySignal<boolean>;
}

/**
 * Plays the reveal of every phase CONTINUE commits. The reveal counts as seen
 * once it ends; from then on that phase's reveal can be skipped.
 */
export function bindPhaseReveal(deps: PhaseRevealDeps): () => void {
  const { bus, overlays, revealsSeen, markSeen, reducedMotion } = deps;
  const onCommit = ({ to: phase }: { to: Phase }) => {
    const skippable = revealsSeen().includes(phase);
    overlays.show({
      kind: 'phase-reveal',
      render: (done) => (
        <PhaseReveal phase={phase} skippable={skippable} reducedMotion={reducedMotion.peek()} done={done} />
      ),
      onEnd: () => {
        markSeen(phase);
      },
    });
  };
  bus.subscribe('phase_committed', onCommit);
  return () => bus.unsubscribe('phase_committed', onCommit);
}
