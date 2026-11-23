import type { ReadonlySignal } from '@preact/signals';
import { Phase } from '../../phases/phases';
import { selectPhase } from '../../state/selectors';
import type { LayMode } from '../../platform/settings';
import { LayEggButton } from './LayEggButton';
import { DigButton } from './DigButton';

/** The actions NEST's primary action calls. */
export interface NestPrimaryActions {
  layEgg(): { readonly ok: boolean };
  dig(): { readonly ok: boolean };
}

/**
 * NEST's primary action (Story 1.22; UX-DR12, UX-DR18): `> LAY EGG` in
 * Phase 1, whatever else is affordable; from Colony on `> DIG` (Story 9.2,
 * FR55), which replaced the next-action button here (BUILD and WRKR keep
 * theirs). A latched goal swaps the whole slot for CONTINUE
 * (`[data-primary-continue]`, Shell, Story 1.19).
 *
 * Hook: `[data-nest-primary=lay|dig]`.
 */
export function NestPrimary({ actions, layMode }: { actions: NestPrimaryActions; layMode?: ReadonlySignal<LayMode> }) {
  const phase1 = selectPhase.value === Phase.EGG_LAYING;
  return (
    <div class="nest-primary" data-nest-primary={phase1 ? 'lay' : 'dig'}>
      {phase1 ? <LayEggButton variant="primary" lay={() => actions.layEgg()} layMode={layMode} /> : <DigButton dig={() => actions.dig()} />}
    </div>
  );
}
