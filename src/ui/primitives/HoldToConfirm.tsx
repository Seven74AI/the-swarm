import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals-core';
import type { ConfirmStyle } from '../../platform/settings';
import { ARM_MS, RING_CELLS, RING_ORDER, cellTimeMs, drainStepMs } from './holdConfirm';
import './Button.css';
import './HoldToConfirm.css';

/** The two settings HoldToConfirm reads (a `Settings` signal from main fits). */
export interface ConfirmSettings {
  readonly confirmStyle: ConfirmStyle;
  /** Hold duration, whole ms. */
  readonly confirmHoldMs: number;
}

export interface HoldToConfirmProps {
  /** The verb. Never truncated; upper-cased in `> TAP AGAIN TO <VERB>`. */
  verb: string;
  /** What the verb acts on. Truncated with an ellipsis when the label would not fit. */
  target?: string;
  /** The irreversible intent. Called once, when the hold completes or on the second tap. */
  onConfirm: () => { readonly ok: boolean } | void;
  /** Confirm style and hold duration, passed in from main (platform settings, Story 1.10). */
  settings: ReadonlySignal<ConfirmSettings>;
  /** Why the action can't be used right now. Shown on the cost line; it never fires. */
  disabled?: string | false;
  /** The cost line under the label (ignored while `disabled` gives a reason). */
  cost?: ComponentChildren;
  /** Extra classes for legacy selectors and styles (`btn-prestige`, …). */
  class?: string;
  title?: string;
  /** Stable E2E hooks (`data-action`, …) go straight onto the `<button>`. */
  [hook: `data-${string}`]: string | undefined;
}

type Source = { kind: 'pointer'; id: number } | { kind: 'key'; key: string };

interface Hold {
  source: Source;
  cells: number;
  holdMs: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const isConfirmKey = (key: string): boolean => key === 'Enter' || key === ' ';

/**
 * `ui/primitives/HoldToConfirm` (Story 1.13, UX-DR21): the one control for
 * irreversible actions (prestige, research cancel, save import).
 *
 * - **Hold** (default): pointer-down, or Enter/Space held on the focused
 *   control, starts a square ring of block cells that fills clockwise over
 *   `confirmHoldMs`. The action fires once, when the ring completes. Release,
 *   drag-off, pointer-cancel or blur before that drains the ring and fires
 *   nothing. A plain click never fires.
 * - **Two taps**: the first tap (or keyboard activation) arms the control for
 *   `ARM_MS`: it re-labels `> TAP AGAIN TO <VERB>` in inverse video. A second
 *   tap inside the window fires; otherwise it disarms.
 * - Enter and Space stay with the control (page shortcuts like Space for the primary action,
 *   don't see them).
 * - Disabled uses `aria-disabled`, like `Button`, so it stays focusable.
 * - Looks like a primary `Button` (same CSS), pressed in inverse video.
 */
export function HoldToConfirm(props: HoldToConfirmProps) {
  const { verb, target, onConfirm, settings, disabled = false, cost, class: extraClass, title, ...hooks } = props;
  const { confirmStyle } = settings.value;
  const pressed = useSignal(false);
  const [cells, setCells] = useState(0);
  const [armed, setArmed] = useState(false);
  const hold = useRef<Hold | null>(null);
  const drainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useRef(0);
  const confirm = useRef(onConfirm);
  confirm.current = onConfirm;
  const costId = useId();

  const isDisabled = disabled !== false && disabled !== '';
  const costLine = isDisabled ? disabled : cost;
  const holdMode = confirmStyle !== 'twoTaps';

  function show(n: number): void {
    shown.current = n;
    setCells(n);
  }

  function stopDrain(): void {
    if (drainTimer.current != null) clearTimeout(drainTimer.current);
    drainTimer.current = null;
  }

  function disarm(): void {
    if (armTimer.current != null) clearTimeout(armTimer.current);
    armTimer.current = null;
    setArmed(false);
  }

  useEffect(
    () => () => {
      if (hold.current?.timer != null) clearTimeout(hold.current.timer);
      hold.current = null;
      stopDrain();
      if (armTimer.current != null) clearTimeout(armTimer.current);
    },
    [],
  );

  // Changing the confirm style resets any hold or armed tap.
  useEffect(() => {
    abort();
    disarm();
  }, [confirmStyle]);

  function step(): void {
    const h = hold.current;
    if (!h) return;
    h.cells += 1;
    if (h.cells >= RING_CELLS) {
      hold.current = null;
      pressed.value = false;
      show(0);
      confirm.current();
      return;
    }
    show(h.cells);
    h.timer = setTimeout(step, cellTimeMs(h.cells + 1, h.holdMs) - cellTimeMs(h.cells, h.holdMs));
  }

  function start(source: Source): void {
    if (isDisabled || hold.current) return;
    stopDrain();
    const holdMs = settings.peek().confirmHoldMs;
    pressed.value = true;
    show(0);
    hold.current = { source, cells: 0, holdMs, timer: setTimeout(step, cellTimeMs(1, holdMs)) };
  }

  function drain(stepMs: number): void {
    if (shown.current <= 0) {
      drainTimer.current = null;
      return;
    }
    show(shown.current - 1);
    drainTimer.current = setTimeout(() => drain(stepMs), stepMs);
  }

  /** End a hold before it completes: nothing fires, the ring drains. */
  function abort(): void {
    const h = hold.current;
    pressed.value = false;
    if (!h) return;
    if (h.timer != null) clearTimeout(h.timer);
    hold.current = null;
    stopDrain();
    const stepMs = drainStepMs(h.holdMs);
    drainTimer.current = setTimeout(() => drain(stepMs), stepMs);
  }

  const holding = (match: (s: Source) => boolean): boolean => hold.current != null && match(hold.current.source);

  function onPointerDown(e: PointerEvent): void {
    if (isDisabled || e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    // Touch pointers are captured implicitly; release so dragging off is seen.
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (holdMode) start({ kind: 'pointer', id: e.pointerId });
    else pressed.value = true;
  }

  function onPointerEnd(e: PointerEvent): void {
    if (!holdMode) {
      pressed.value = false;
      return;
    }
    if (holding((s) => s.kind === 'pointer' && s.id === e.pointerId)) abort();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!isConfirmKey(e.key)) return;
    e.stopPropagation();
    if (!holdMode) return;
    // No native click: the hold decides.
    e.preventDefault();
    if (!e.repeat) start({ kind: 'key', key: e.key });
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (!isConfirmKey(e.key)) return;
    e.stopPropagation();
    if (!holdMode) return;
    e.preventDefault();
    if (holding((s) => s.kind === 'key' && s.key === e.key)) abort();
  }

  function onBlur(): void {
    if (holding((s) => s.kind === 'key')) abort();
  }

  function onClick(e: MouseEvent): void {
    e.preventDefault();
    if (holdMode || isDisabled) return;
    if (armTimer.current != null) {
      disarm();
      confirm.current();
      return;
    }
    setArmed(true);
    armTimer.current = setTimeout(() => {
      armTimer.current = null;
      setArmed(false);
    }, ARM_MS);
  }

  const showArmed = armed && !holdMode && !isDisabled;
  const label = target ? `${verb} ${target}` : verb;

  return (
    <button
      type="button"
      class={`swarm-btn swarm-confirm${extraClass ? ` ${extraClass}` : ''}`}
      data-variant={isDisabled ? 'disabled' : 'primary'}
      data-kind="primary"
      data-confirm-style={holdMode ? 'hold' : 'twoTaps'}
      data-pressed={pressed}
      data-armed={showArmed ? 'true' : undefined}
      data-progress={holdMode ? String(cells) : undefined}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-label={showArmed ? `Tap again to ${label}` : holdMode ? `Hold to ${label}` : label}
      aria-describedby={costLine != null ? costId : undefined}
      title={title}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      {...hooks}
    >
      <span class="swarm-btn__line">
        {holdMode && (
          <span class="swarm-confirm__ring" data-ring="" aria-hidden="true">
            {RING_ORDER.map((c, i) => (
              <span
                key={i}
                class="swarm-confirm__cell"
                data-ring-cell={String(i)}
                data-filled={i < cells ? 'true' : 'false'}
                style={{ gridRow: c.row + 1, gridColumn: c.col + 1 }}
              >
                {i < cells ? '█' : '░'}
              </span>
            ))}
          </span>
        )}
        {showArmed ? (
          <span class="swarm-btn__label">
            <span class="swarm-btn__verb" data-verb="">
              {`> TAP AGAIN TO ${verb.toUpperCase()}`}
            </span>
          </span>
        ) : (
          <span class="swarm-btn__label">
            <span class="swarm-btn__verb" data-verb="">
              {verb}
            </span>
            {target && (
              <span class="swarm-btn__target" data-target="">
                {target}
              </span>
            )}
          </span>
        )}
      </span>
      {costLine != null && (
        <span class="swarm-btn__cost" data-cost="" id={costId}>
          {costLine}
        </span>
      )}
    </button>
  );
}
