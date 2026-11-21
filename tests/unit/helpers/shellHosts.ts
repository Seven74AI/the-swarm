import { SEGMENTS, TABS } from '../../../src/data/content/tabs';
import { hostsFromRoot, type ShellHosts } from '../../../src/ui/shell/hosts';

/**
 * The tab shell's host containers without Preact (Story 1.15), for unit tests
 * that mount the legacy UIRoot directly. Same data-* hooks as ui/shell/Shell.tsx.
 */
export function shellHosts(container: HTMLElement): ShellHosts {
  container.innerHTML = '';
  const strip = document.createElement('header');
  strip.setAttribute('data-shell-strip', '');
  const scroll = document.createElement('main');
  scroll.id = 'panels';
  scroll.setAttribute('data-shell-scroll', '');
  const primary = document.createElement('div');
  primary.setAttribute('data-primary-zone', '');
  for (const t of TABS) {
    const section = document.createElement('section');
    section.setAttribute('data-tab-panel', t.id);
    const content = document.createElement('div');
    content.setAttribute('data-tab-content', t.id);
    section.appendChild(content);
    for (const s of SEGMENTS.filter((x) => x.tab === t.id)) {
      const seg = document.createElement('div');
      seg.setAttribute('data-segment-panel', s.id);
      section.appendChild(seg);
    }
    scroll.appendChild(section);
    const slot = document.createElement('div');
    slot.setAttribute('data-primary-for', t.id);
    primary.appendChild(slot);
  }
  container.append(strip, scroll, primary);
  return hostsFromRoot(container);
}
