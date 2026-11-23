import { selectAutoDigOn, selectDigHint } from '../../state/selectors';
import { Button } from '../primitives/Button';

export interface DigButtonProps {
  /** Digs: `actions.dig`. */
  dig: () => { readonly ok: boolean };
}

/**
 * `> DIG` (Story 9.2, FR55, UX-DR11): NEST's primary action from Colony on.
 * Each press digs a chunk of the current room through the action; hold
 * repeats at the hold-repeat rate, like every primary action. Space presses it
 * through the primary-action shortcut (Story 1.30). Once auto-dig is bought
 * (Story 9.5) it reads `> AUTO-DIG ON` with the hint `tap to boost the dig`,
 * and a press still adds a chunk. Before that its hint line (Story 9.7) says
 * what a press digs: `chunk +12 · 1 stone / 17 digs`, plus the FEED tip while
 * a room is free (`selectDigHint`).
 *
 * Hook: `button[data-action="dig"]` (`[data-auto-dig]` while auto-dig is on).
 */
export function DigButton({ dig }: DigButtonProps) {
  const auto = selectAutoDigOn.value;
  const hint = selectDigHint.value;
  return (
    <Button
      variant="primary"
      verb={auto ? 'AUTO-DIG ON' : 'DIG'}
      cost={auto ? 'tap to boost the dig' : hint}
      repeat
      onPress={() => dig()}
      data-action="dig"
      data-auto-dig={auto ? 'on' : undefined}
    />
  );
}
