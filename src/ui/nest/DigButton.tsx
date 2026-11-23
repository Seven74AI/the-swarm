import { Button } from '../primitives/Button';

export interface DigButtonProps {
  /** Digs: `actions.dig`. */
  dig: () => { readonly ok: boolean };
}

/**
 * `> DIG` (Story 9.2, FR55, UX-DR11): NEST's primary action from Colony on.
 * Each press digs a chunk of the current room through the action; hold
 * repeats at the hold-repeat rate, like every primary action. Space presses it
 * through the primary-action shortcut (Story 1.30).
 *
 * Hook: `button[data-action="dig"]`.
 */
export function DigButton({ dig }: DigButtonProps) {
  return <Button variant="primary" verb="DIG" repeat onPress={() => dig()} data-action="dig" />;
}
