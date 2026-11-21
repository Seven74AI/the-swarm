import { selectBuildAction, type ActionIntent } from '../../state/selectors';
import { NextActionButton } from '../shell/NextActionButton';

/**
 * BUILD's pinned primary action (Story 1.24): `> BUY <target>` on the
 * highlighted card (`selectBuildAction`), with the same target lock as NEST's
 * next action. Empty while nothing is affordable: the header then names what
 * comes next. Hooks: `[data-build-primary]`, `[data-action="buy-highlighted"]`.
 */
export function BuildPrimary({ perform }: { perform: (intent: ActionIntent) => { readonly ok: boolean } }) {
  return (
    <div class="build-primary" data-build-primary="">
      <NextActionButton next={selectBuildAction} perform={perform} hook="buy-highlighted" describeNone={() => ''} />
    </div>
  );
}
