import type { Announcer } from './announcer';

/**
 * The one polite live region (Story 1.32, UX-DR40). It is in the page from
 * boot, empty, so assistive tech is already listening when the first line
 * arrives. Each line is a new keyed node added at the end (the oldest drop
 * off), so a repeat is read again and two lines at once are both read.
 * Hook: `[data-announcer]`.
 */
export function LiveRegion({ announcer }: { announcer: Announcer }) {
  const lines = announcer.lines.value;
  return (
    <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions" data-announcer="">
      {lines.map((l) => (
        <p key={l.id}>{l.text}</p>
      ))}
    </div>
  );
}
