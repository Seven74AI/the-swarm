import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useContext, useEffect, useId, useLayoutEffect, useRef } from 'preact/hooks';
import { Button } from '../primitives/Button';
import './Sheet.css';

/**
 * Modal and peek sheets (Story 1.14; UX-DR22, DESIGN.md → Sheets and overlays).
 *
 * They are drawn by `SheetHost` for the open entry of the `SheetController`, which
 * provides `SheetContext` (how to close this sheet, and where focus returns).
 *
 * Modal: scrim, `raised` panel with an `accent` top rule, a `────` handle, the
 * headline in `display`, the body, and at most two actions. It is
 * `role="dialog"` + `aria-modal`; focus moves to the headline on open, Tab stays
 * inside, and focus returns to the trigger on close. A dismissible sheet closes
 * by swipe down, scrim tap, `[ CLOSE ]` or Esc, and `[ CLOSE ]` is one of its
 * two actions. A decision sheet (`dismissible={false}`) closes only by its own
 * choices or timer: it has no `[ CLOSE ]`, and its scrim lets taps through,
 * because a tap there can't close it and the colony keeps running underneath.
 *
 * Peek: no scrim, at most 160 px tall, a header naming the target, at most two
 * actions (`[ CLOSE ]` included). Esc closes it. It doesn't take focus.
 */

/** A downward drag of at least this many px closes a dismissible modal sheet. */
export const SWIPE_CLOSE_PX = 64;

export interface SheetContextValue {
  close: () => void;
  trigger: HTMLElement | null;
}

export const SheetContext = createContext<SheetContextValue>({ close: () => {}, trigger: null });

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type Hooks = { [hook: `data-${string}`]: string | undefined };

interface ModalBase extends Hooks {
  headline: ComponentChildren;
  children?: ComponentChildren;
  /** Legacy hook classes for the panel and scrim (`offline-summary-popup`, `offline-overlay`). */
  class?: string;
  scrimClass?: string;
  id?: string;
  headlineClass?: string;
}

/** A dismissible sheet: one action of its own plus `[ CLOSE ]` (relabelled with `closeLabel`). */
interface DismissibleModal extends ModalBase {
  dismissible?: true;
  action?: ComponentChildren;
  closeLabel?: string;
}

/** A decision sheet: closes only through its own buttons; up to two actions. */
interface DecisionModal extends ModalBase {
  dismissible: false;
  actions?: readonly [ComponentChildren] | readonly [ComponentChildren, ComponentChildren];
  /** Let taps through the scrim to the colony (default). `false` blocks them: the game can't go on underneath. */
  passthrough?: boolean;
}

export type ModalSheetProps = DismissibleModal | DecisionModal;

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'));
}

function CloseButton({ label, close }: { label?: string; close: () => void }) {
  return label ? (
    <Button verb={label} onPress={close} data-sheet-close="" />
  ) : (
    <Button verb="[ CLOSE ]" label="Close" onPress={close} data-sheet-close="" />
  );
}

export function ModalSheet(props: ModalSheetProps) {
  const { headline, children, class: cls, scrimClass, id, headlineClass, ...rest } = props;
  const { close, trigger } = useContext(SheetContext);
  const dismissible = props.dismissible !== false;
  const panel = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const drag = useRef<{ pointerId: number; y: number } | null>(null);
  const headlineId = useId();

  const hooks: Hooks = {};
  for (const [k, v] of Object.entries(rest)) if (k.startsWith('data-')) hooks[k as `data-${string}`] = v as string;

  // Focus to the headline on open and kept inside; back to the trigger on close.
  useLayoutEffect(() => {
    const el = panel.current;
    const onFocusIn = (e: FocusEvent) => {
      if (el && e.target instanceof Node && !el.contains(e.target)) head.current?.focus();
    };
    head.current?.focus();
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      const active = document.activeElement;
      const lost = !active || active === document.body || !active.isConnected || (el?.contains(active) ?? false);
      if (lost && trigger?.isConnected) trigger.focus();
    };
  }, [trigger]);

  // Esc and the Tab trap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = panel.current;
      if (!el) return;
      if (e.key === 'Escape') {
        if (dismissible) {
          e.preventDefault();
          close();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(el);
      if (items.length === 0) {
        e.preventDefault();
        head.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === head.current || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismissible, close]);

  function onPointerDown(e: PointerEvent): void {
    if (!dismissible || e.button !== 0) return;
    // A press on a control belongs to that control (Buttons fire on their own pointer-up).
    if (e.target instanceof Element && e.target.closest(FOCUSABLE)) return;
    drag.current = { pointerId: e.pointerId, y: e.clientY };
    // Keep the drag when the finger leaves the sheet on its way down.
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function dragDistance(e: PointerEvent): number {
    const d = drag.current;
    return d && d.pointerId === e.pointerId ? Math.max(0, e.clientY - d.y) : 0;
  }
  function onPointerMove(e: PointerEvent): void {
    const dy = dragDistance(e);
    if (panel.current && drag.current) panel.current.style.setProperty('--sheet-drag', `${Math.floor(dy)}px`);
  }
  function onPointerUp(e: PointerEvent): void {
    const dy = dragDistance(e);
    drag.current = null;
    panel.current?.style.removeProperty('--sheet-drag');
    if (dy >= SWIPE_CLOSE_PX) close();
  }
  function onPointerCancel(): void {
    drag.current = null;
    panel.current?.style.removeProperty('--sheet-drag');
  }

  const actions = props.dismissible === false ? (props.actions ?? []) : props.action ? [props.action] : [];

  return (
    <>
      <div
        class={['sheet-scrim', scrimClass].filter(Boolean).join(' ')}
        data-sheet-scrim=""
        data-passthrough={dismissible || props.passthrough === false ? undefined : ''}
        onClick={dismissible ? close : undefined}
        aria-hidden="true"
      />
      <div
        ref={panel}
        id={id}
        class={['sheet', 'sheet--modal', cls].filter(Boolean).join(' ')}
        data-sheet="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headlineId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        {...hooks}
      >
        <div class="sheet__handle" data-sheet-handle="" aria-hidden="true">
          ────
        </div>
        <h2
          ref={head}
          id={headlineId}
          class={['sheet__headline', headlineClass].filter(Boolean).join(' ')}
          data-sheet-headline=""
          data-display=""
          tabIndex={-1}
        >
          {headline}
        </h2>
        <div class="sheet__body">{children}</div>
        {(actions.length > 0 || dismissible) && (
          <div class="sheet__actions" data-sheet-actions="">
            {actions}
            {props.dismissible !== false && <CloseButton label={props.closeLabel} close={close} />}
          </div>
        )}
      </div>
    </>
  );
}

export interface PeekSheetProps extends Hooks {
  /** Names the target, e.g. `MEADOW · (5,3)`. */
  header: ComponentChildren;
  children?: ComponentChildren;
  /** One action of its own; `[ CLOSE ]` is the second. */
  action?: ComponentChildren;
}

export function PeekSheet({ header, children, action, ...hooks }: PeekSheetProps) {
  const { close } = useContext(SheetContext);
  const headerId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div class="sheet sheet--peek" data-sheet="peek" role="dialog" aria-labelledby={headerId} {...hooks}>
      <div class="sheet__header" id={headerId} data-sheet-header="">
        {header}
      </div>
      <div class="sheet__body">{children}</div>
      <div class="sheet__actions" data-sheet-actions="">
        {action}
        <CloseButton close={close} />
      </div>
    </div>
  );
}
