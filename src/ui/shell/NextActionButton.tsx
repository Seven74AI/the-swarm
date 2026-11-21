import type { ReadonlySignal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../primitives/Button';
import type { ActionIntent, NextAction, NoAction } from '../../state/selectors';
import { nextActionBalance } from '../../data/balance/nextAction';
import { formatTime } from '../../utils/format';
import { lockedTarget, type TargetLock } from './targetLock';

export interface NextActionButtonProps {
  /** The suggestion, normally `selectNextAction`. */
  next: ReadonlySignal<NextAction>;
  /** Runs an intent, normally `actions.perform`. */
  perform: (intent: ActionIntent) => { readonly ok: boolean };
  /** UI clock in ms (tests may pass their own). */
  now?: () => number;
  /** The button's `data-action` hook (default `next-action`; BUILD's is `buy-highlighted`, Story 1.24). */
  hook?: string;
  /** The line shown when nothing is suggested (default `NEXT AFFORDABLE: <item> IN ~<time>`); a custom one returning '' renders nothing. */
  describeNone?: (none: NoAction) => string;
}

/** `NEXT AFFORDABLE: <item> IN ~<time>` ('' when nothing is reachable); the offline summary uses it too (Story 2.9). */
export function nextAffordableLine(none: NoAction): string {
  const item = none.nextAffordable;
  return item ? `NEXT AFFORDABLE: ${item.name.toUpperCase()} IN ~${formatTime(item.inSec * 1000).toUpperCase()}` : '';
}

/**
 * The next-action primary action (Story 1.21, UX-DR12): the one most useful
 * action as a primary `Button`, or `NEXT AFFORDABLE: <item> IN ~<time>` when
 * there is none. The target is locked while held and for
 * `nextActionBalance.targetLockMs` after the last touch, so a repeat or a
 * quick second tap always lands on what the player saw.
 *
 * Hooks: `[data-next-action=<rule>|none]`, `[data-next-key]`, the button's
 * `data-action="next-action"`. NEST mounts it in its primary zone after
 * Phase 1 (Story 1.22); the offline summary shows `getReturnMove` (Story 2.9).
 */
export function NextActionButton({ next, perform, now = () => Date.now(), hook = 'next-action', describeNone = nextAffordableLine }: NextActionButtonProps) {
  const latest = next.value;
  const shownRef = useRef<NextAction | null>(null);
  const lock = useRef<TargetLock>({ holding: false, lastTouchMs: null });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setWake] = useState(0);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const shown = lockedTarget(shownRef.current, latest, lock.current, now(), nextActionBalance.targetLockMs);
  shownRef.current = shown;

  /** Record a touch, and re-render once the lock window after it has passed. */
  function touch(holding: boolean): void {
    lock.current = { holding, lastTouchMs: now() };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = holding
      ? null
      : setTimeout(() => {
          timer.current = null;
          setWake((n) => n + 1);
        }, nextActionBalance.targetLockMs);
  }

  if (shown.kind === 'none') {
    const line = describeNone(shown);
    if (line === '' && describeNone !== nextAffordableLine) return null;
    return (
      <p class="next-affordable" data-next-action="none" data-next-key={shown.key}>
        {line}
      </p>
    );
  }

  const target = shown;
  return (
    <div
      class="next-action"
      data-next-action={target.rule}
      data-next-key={target.key}
      onPointerDownCapture={() => touch(true)}
      onPointerUpCapture={() => touch(false)}
      onPointerCancelCapture={() => touch(false)}
      onPointerLeave={() => {
        if (lock.current.holding) touch(false);
      }}
      onClickCapture={(e) => {
        if (e.detail === 0) touch(false);
      }}
    >
      <Button
        variant="primary"
        verb={target.verb}
        target={target.target}
        repeat={target.intent.action !== 'continuePhase'}
        onPress={() => perform(target.intent)}
        data-action={hook}
      />
    </div>
  );
}
