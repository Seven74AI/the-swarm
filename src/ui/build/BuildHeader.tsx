import { selectBuildAction } from '../../state/selectors';
import { formatTime } from '../../utils/format';

/**
 * BUILD's header (Story 1.24, UX-DR17): `BUILD`, or `NEXT: <item> IN ~<time>`
 * while nothing on BUILD is affordable (the item that becomes affordable
 * soonest at the current rates). Hook: `[data-build-header]`, with
 * `data-next-key` naming that item.
 */
export function BuildHeader() {
  const pick = selectBuildAction.value;
  const next = pick.kind === 'none' ? pick.nextAffordable : null;
  return (
    <h2 class="build-header" data-build-header="" data-next-key={next?.key}>
      {next ? `NEXT: ${next.name.toUpperCase()} IN ~${formatTime(next.inSec * 1000).toUpperCase()}` : 'BUILD'}
    </h2>
  );
}
