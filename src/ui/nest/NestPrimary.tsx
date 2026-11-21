import type { ReadonlySignal } from '@preact/signals';
import { Phase } from '../../phases/phases';
import { selectNextAction, selectPhase, type ActionIntent } from '../../state/selectors';
import type { LayMode } from '../../platform/settings';
import { NextActionButton } from '../shell/NextActionButton';
import { LayEggButton } from './LayEggButton';

/** The actions NEST's primary action calls. */
export interface NestPrimaryActions {
  layEgg(): { readonly ok: boolean };
  perform(intent: ActionIntent): { readonly ok: boolean };
}

/**
 * NEST's primary action (Story 1.22; UX-DR12, UX-DR18): `> LAY EGG` in
 * Phase 1, whatever else is affordable; after Phase 1 the next-action button
 * (`getNextAction`, Story 1.21), which shows `NEXT AFFORDABLE: <item> IN
 * ~<time>` when nothing is suggested. A latched goal swaps the whole slot
 * for CONTINUE (`[data-primary-continue]`, Shell, Story 1.19).
 *
 * Hook: `[data-nest-primary=lay|next]`.
 */
export function NestPrimary({ actions, layMode }: { actions: NestPrimaryActions; layMode?: ReadonlySignal<LayMode> }) {
  const phase1 = selectPhase.value === Phase.EGG_LAYING;
  return (
    <div class="nest-primary" data-nest-primary={phase1 ? 'lay' : 'next'}>
      {phase1 ? (
        <LayEggButton variant="primary" lay={() => actions.layEgg()} layMode={layMode} />
      ) : (
        <NextActionButton next={selectNextAction} perform={(intent) => actions.perform(intent)} />
      )}
    </div>
  );
}
