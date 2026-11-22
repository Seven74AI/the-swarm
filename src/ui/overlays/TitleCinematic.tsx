import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ReadonlySignal } from '@preact/signals';
import { TITLE_BEATS, TITLE_COPY } from '../../data/content/titleCinematic';
import type { IntroFlag } from '../../platform/storage/introFlag';
import type { OverlayController } from '../shell/OverlayController';
import { TitleScene } from '../scene/TitleScene';
import { TitleLogo } from '../scene/TitleLogo';
import './TitleCinematic.css';

/**
 * The title cinematic (Story 8.10; UX-DR28, EXPERIENCE.md → Flow 1 and State
 * Patterns → First launch, `mockups/title-cinematic.html`).
 *
 * On first launch (no save and no intro flag) a full-screen overlay plays for
 * about 11 s in Phase 1 amber only (`data-palette="egg"` pins the Phase 1
 * aliases, so a replay from a later phase is amber too): the queen lands,
 * tunnels down, the first chamber opens (`ONE EGG.`), the colony swarms
 * (`ONE QUEEN.`), the ants march up into THE SWARM and its tagline.
 * - A tap, Enter, Space or Esc (or the SKIP INTRO button) skips to the title frame.
 * - The title frame waits on a real `[ TAP TO WAKE THE QUEEN ]` button (Enter,
 *   Space or Esc wake her too), then `A QUEEN, ALONE.` holds for
 *   `TITLE_BEATS.aloneMs` and the overlay ends on the brood chamber.
 * - Reduced motion opens on the title frame, standing still.
 * - Every key is swallowed: nothing reaches the game behind it.
 * The flag is set when it starts (`bindTitleCinematic`), so a cinematic left
 * mid-way never plays by itself again; settings → REPLAY INTRO plays it on request.
 * It is a CRT scene surface (Story 8.4): scanlines under its text, the scene glows.
 * Hooks: `[data-overlay="title-cinematic"][data-stage="playing|title|alone"]`,
 * `[data-title-line]`, `[data-title-skip]`, `[data-title-logo]`, `[data-title-tagline]`,
 * `[data-action="wake-queen"]`, `[data-title-alone]`.
 */

export type TitleStage = 'playing' | 'title' | 'alone';

const ACT_KEYS = new Set(['Enter', ' ', 'Spacebar', 'Escape']);

interface TitleCinematicProps {
  /** Under reduced motion it opens on its title frame and nothing moves. */
  reducedMotion: boolean;
  done: () => void;
}

const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());
const nextFrame = (cb: () => void): number =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
const cancelFrame = (id: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
};

/** The line under the scene at each beat. */
type Beat = 'none' | 'egg' | 'queen';

export function TitleCinematic({ reducedMotion, done }: TitleCinematicProps) {
  const root = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const wakeRef = useRef<HTMLButtonElement>(null);
  const [stage, setStage] = useState<TitleStage>(reducedMotion ? 'title' : 'playing');
  const [beat, setBeat] = useState<Beat>('none');
  const [ms, setMs] = useState(reducedMotion ? TITLE_BEATS.titleMs : 0);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  /** Scene time = now - origin; a skip moves the origin so the title frame starts at once. */
  const origin = useRef(now());
  const ended = useRef(false);

  const toTitle = () => {
    if (stageRef.current !== 'playing') return;
    origin.current = now() - TITLE_BEATS.titleMs;
    stageRef.current = 'title';
    setMs(TITLE_BEATS.titleMs);
    setStage('title');
  };
  const wake = () => {
    if (stageRef.current !== 'title') return;
    stageRef.current = 'alone';
    setStage('alone');
  };
  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    done();
  };
  const act = { toTitle, wake, finish };
  const actRef = useRef(act);
  actRef.current = act;

  // Focus follows the stage: the skip while it plays, the wake button on the title frame, the dialog after.
  useLayoutEffect(() => {
    const target = stage === 'playing' ? skipRef.current : stage === 'title' ? wakeRef.current : root.current;
    target?.focus();
  }, [stage]);

  // The beats: the lines, and the title frame when it plays out. Layout effects, so the
  // timers start with the first frame drawn, not a frame later.
  useLayoutEffect(() => {
    if (reducedMotion) return;
    const timers = [
      setTimeout(() => setBeat('egg'), TITLE_BEATS.eggMs),
      setTimeout(() => setBeat('queen'), TITLE_BEATS.queenMs),
      setTimeout(() => setBeat('none'), TITLE_BEATS.marchStartMs),
      setTimeout(() => actRef.current.toTitle(), TITLE_BEATS.titleMs),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reducedMotion]);

  // The scene moves with the clock, a frame at a time (still under reduced motion).
  useEffect(() => {
    if (reducedMotion) return;
    let id = 0;
    const frame = () => {
      setMs(Math.max(0, Math.floor(now() - origin.current)));
      id = nextFrame(frame);
    };
    id = nextFrame(frame);
    return () => cancelFrame(id);
  }, [reducedMotion]);

  // `A QUEEN, ALONE.` holds, then the brood chamber.
  useLayoutEffect(() => {
    if (stage !== 'alone') return;
    const t = setTimeout(() => actRef.current.finish(), TITLE_BEATS.aloneMs);
    return () => clearTimeout(t);
  }, [stage]);

  // Blocks every key from reaching the game; Enter, Space and Esc move the cinematic on.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || !ACT_KEYS.has(e.key)) return;
      const s = stageRef.current;
      if (s === 'playing') actRef.current.toTitle();
      else if (s === 'title') actRef.current.wake();
      else actRef.current.finish();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const line = stage === 'playing' && beat !== 'none' ? TITLE_COPY[beat] : '';
  const sceneMs = stage === 'playing' ? Math.min(ms, TITLE_BEATS.titleMs - 1) : Math.max(ms, TITLE_BEATS.titleMs);
  return (
    <div
      ref={root}
      class="title-cinematic"
      role="dialog"
      aria-modal="true"
      aria-label={TITLE_COPY.logo}
      tabIndex={-1}
      data-overlay="title-cinematic"
      data-palette="egg"
      data-crt-surface=""
      data-stage={stage}
      onPointerDown={(e) => {
        const s = stageRef.current;
        if (s === 'title') return; // only the button wakes her
        e.preventDefault();
        if (s === 'playing') toTitle();
        else finish();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <TitleScene ms={reducedMotion ? TITLE_BEATS.titleMs : sceneMs} class="title-cinematic__scene" />
      {stage === 'playing' && (
        <>
          <button ref={skipRef} type="button" class="title-cinematic__skip" data-title-skip="" onClick={toTitle}>
            {TITLE_COPY.skip}
          </button>
          <p class="title-cinematic__line" data-title-line="" aria-live="polite">
            {line}
          </p>
        </>
      )}
      {stage === 'title' && (
        <>
          <h1 class="title-cinematic__logo" data-title-logo="">
            <span class="title-cinematic__the" aria-hidden="true">
              T H E
            </span>
            <TitleLogo class="title-cinematic__swarm" />
            <span class="visually-hidden">{TITLE_COPY.logo}</span>
          </h1>
          <p class="title-cinematic__tagline" data-title-tagline="">
            {TITLE_COPY.tagline}
          </p>
          <button ref={wakeRef} type="button" class="title-cinematic__wake" data-action="wake-queen" onClick={wake}>
            <span aria-hidden="true">[ </span>
            {TITLE_COPY.wake}
            <span aria-hidden="true"> ]</span>
          </button>
        </>
      )}
      {stage === 'alone' && (
        <p class="title-cinematic__alone" data-title-alone="" role="status">
          {TITLE_COPY.alone}
        </p>
      )}
    </div>
  );
}

export interface TitleCinematicDeps {
  overlays: OverlayController;
  /** Whether the cinematic has started on this device (platform/storage/introFlag). */
  flag: IntroFlag;
  /** A save was found (any load status but `empty`): only a first launch plays it by itself. */
  hasSave: boolean;
  reducedMotion: ReadonlySignal<boolean>;
  /** Runs when the overlay ends, on the brood chamber: main shows the LAY EGG coach mark. */
  onWoken: () => void;
}

export interface TitleCinematicBinding {
  /** Play it again (settings → REPLAY INTRO): the save and the flag are left as they are. */
  replay(): void;
}

/**
 * Plays the cinematic on first launch (no save and no intro flag), setting the
 * flag as it starts, and returns the replay.
 */
export function bindTitleCinematic(deps: TitleCinematicDeps): TitleCinematicBinding {
  const { overlays, flag, hasSave, reducedMotion, onWoken } = deps;
  const play = (): void => {
    overlays.show({
      kind: 'title-cinematic',
      render: (done) => <TitleCinematic reducedMotion={reducedMotion.peek()} done={done} />,
      onEnd: onWoken,
    });
  };
  if (!hasSave && !flag.done()) {
    flag.markDone();
    play();
  }
  return { replay: play };
}
