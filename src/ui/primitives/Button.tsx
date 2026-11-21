import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { useComputed, useSignal } from '@preact/signals';
import { HOLD_DELAY_MS, repeatDelay } from './holdRepeat';
import { decorate } from './Deco';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps {
  /** `primary`: the one verb of a screen (`> ` prefix, cursor, accent border). Default `secondary`. */
  variant?: ButtonVariant;
  /** The verb. Never truncated. */
  verb: string;
  /** What the verb acts on. Truncated with an ellipsis when the label would not fit. */
  target?: string;
  /** Accessible name, only when the visible label is typed decoration (a stepper's `[+]`): the face is then hidden and this is read. Default: the visible verb and target (WCAG 2.5.3); the cost line is the description. */
  label?: string;
  /**
   * The intent. Called on release (a tap), or repeatedly while held when `repeat`
   * is set. Returning a refusal (an `ActionResult` with `ok: false`) stops the repeat.
   */
  onPress: () => { readonly ok: boolean } | void;
  /** Hold repeats the action (buy, assign, lay). */
  repeat?: boolean;
  /** Why the button can't be used right now. Shown on the cost line; the button never fires. */
  disabled?: string | false;
  /** The cost line under the label (ignored while `disabled` gives a reason). */
  cost?: ComponentChildren;
  /** An id kept from a legacy control (`#click-egg`, Story 1.22). */
  id?: string;
  /** Extra classes kept from a legacy control as hooks (`click-button-at-capacity`). */
  className?: string;
  /** Stable E2E hooks (`data-action`, …) go straight onto the `<button>`. */
  [hook: `data-${string}`]: string | undefined;
}

interface Hold {
  pointerId: number;
  timer: ReturnType<typeof setTimeout> | null;
  heldMs: number;
  fired: boolean;
  stopped: boolean;
}

/**
 * `ui/primitives/Button` (Story 1.11; UX-DR11, UX-DR20, UX-DR38; FR45; NFR1).
 *
 * - Pointer-down shows the pressed (inverse) state at once, through a signal
 *   bound straight to `data-pressed`: no re-render, no state write first.
 *   It stays inverse until release and never toggles on a repeat.
 * - The action fires on pointer-up over the button. Leaving the button or a
 *   pointer-cancel (the page scrolls) cancels the press.
 * - With `repeat`, a held press fires after `HOLD_DELAY_MS`, then at about
 *   8/s, faster after 1 s (`holdRepeat.ts`), each time through `onPress`, and
 *   stops at the first refusal. A release after repeats fires nothing more.
 * - Disabled uses `aria-disabled`, so the button stays focusable and its
 *   reason (on the cost line) is announced with it.
 * - The cursor of a primary action blinks (CSS, 1 Hz, 5 cycles) after mount and
 *   after each release, holds steady while pressed, and never blinks while
 *   reduced motion is in effect (`:root[data-reduced-motion="true"]`).
 *   With the single inversion per press, this keeps a held button under
 *   3 luminance changes per second (flash rule, UX-DR38).
 */
export function Button(props: ButtonProps) {
  const { variant = 'secondary', verb, target, label, onPress, repeat = false, disabled = false, cost, id, className, ...hooks } = props;
  const pressed = useSignal(false);
  const blink = useComputed(() => String(!pressed.value));
  const [blinkRun, setBlinkRun] = useState(0);
  const hold = useRef<Hold | null>(null);
  const press = useRef(onPress);
  press.current = onPress;
  const costId = useId();

  const primary = variant === 'primary';
  const isDisabled = disabled !== false && disabled !== '';
  const costLine = isDisabled ? disabled : cost;

  function clear(): void {
    const h = hold.current;
    if (h?.timer != null) clearTimeout(h.timer);
    hold.current = null;
    pressed.value = false;
  }

  useEffect(() => clear, []);

  /** Run the action once; true while it is accepted. */
  function fire(): boolean {
    const result = press.current();
    return !(result && result.ok === false);
  }

  function step(): void {
    const h = hold.current;
    if (!h || h.stopped) return;
    h.fired = true;
    if (!fire()) {
      h.stopped = true;
      h.timer = null;
      return;
    }
    const delay = repeatDelay(h.heldMs);
    h.heldMs += delay;
    h.timer = setTimeout(step, delay);
  }

  function onPointerDown(e: PointerEvent): void {
    if (isDisabled || e.button !== 0 || hold.current) return;
    const el = e.currentTarget as HTMLElement;
    // Touch pointers are captured implicitly; release so dragging off is seen.
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    pressed.value = true;
    hold.current = {
      pointerId: e.pointerId,
      timer: repeat ? setTimeout(step, HOLD_DELAY_MS) : null,
      heldMs: HOLD_DELAY_MS,
      fired: false,
      stopped: false,
    };
  }

  function onPointerUp(e: PointerEvent): void {
    const h = hold.current;
    if (!h || h.pointerId !== e.pointerId) return;
    const tapped = !h.fired;
    clear();
    if (tapped) fire();
    setBlinkRun((n) => n + 1);
  }

  function onPointerAway(e: PointerEvent): void {
    const h = hold.current;
    if (!h || h.pointerId !== e.pointerId) return;
    clear();
  }

  function onClick(e: MouseEvent): void {
    // Pointer presses fire on pointer-up; only keyboard activation (detail 0) acts here.
    if (isDisabled || e.detail !== 0) return;
    fire();
    setBlinkRun((n) => n + 1);
  }

  return (
    <button
      type="button"
      id={id}
      class={className ? `swarm-btn ${className}` : 'swarm-btn'}
      data-variant={isDisabled ? 'disabled' : variant}
      data-kind={variant}
      data-pressed={pressed}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-describedby={costLine != null ? costId : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerAway}
      onPointerCancel={onPointerAway}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      {...hooks}
    >
      <span class="swarm-btn__line">
        {primary && (
          <span class="swarm-btn__prefix" data-prefix="" aria-hidden="true">
            {'> '}
          </span>
        )}
        {/* A face of typed decoration (`[+]`) is hidden; its full name is read instead (Story 1.32). */}
        {label !== undefined && <span class="visually-hidden">{label}</span>}
        <span class="swarm-btn__label" aria-hidden={label !== undefined ? 'true' : undefined}>
          <span class="swarm-btn__verb" data-verb="">
            {verb}
          </span>
          {target && ' '}
          {target && (
            <span class="swarm-btn__target" data-target="">
              {target}
            </span>
          )}
        </span>
        {primary && !isDisabled && (
          <span key={blinkRun} class="swarm-btn__cursor" data-cursor="" data-blink={blink} aria-hidden="true">
            █
          </span>
        )}
      </span>
      {costLine != null && (
        <span class="swarm-btn__cost" data-cost="" id={costId} aria-hidden="true">
          {decorate(costLine)}
        </span>
      )}
    </button>
  );
}
