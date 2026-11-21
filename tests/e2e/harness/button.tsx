/**
 * E2E harness for `ui/primitives/Button` (Story 1.11). The primitive isn't on a
 * game screen yet (NEST adopts it later), so Playwright drives it here, in a
 * real browser with the real tokens and styles. Dev server only.
 */
import '../../../src/ui/styles/tokens.css';
import '../../../src/ui/styles/base.css';
import '@preact/signals';
import { render } from 'preact';
import { Button } from '../../../src/ui/primitives/Button';
import { OK, refuse } from '../../../src/actions/result';
import { signal } from '@preact/signals-core';
import { bindReducedMotion } from '../../../src/ui/theme/reducedMotion';

// The game passes in the reduced-motion setting (Story 1.10); here the OS preference stands in for it.
bindReducedMotion(document.documentElement, signal(matchMedia('(prefers-reduced-motion: reduce)').matches));

const counts: Record<string, number> = { hold: 0, tap: 0, refusing: 0, disabled: 0, secondary: 0, long: 0 };
(window as unknown as { __presses: typeof counts }).__presses = counts;

/** Accepts this many presses, then refuses. */
const REFUSING_BUDGET = 3;

function count(id: string) {
  return () => {
    counts[id]++;
    return OK;
  };
}

render(
  <>
    <Button variant="primary" verb="LAY" target="EGG" repeat onPress={count('hold')} data-action="hold" />
    <Button variant="primary" verb="START" target="RESEARCH" onPress={count('tap')} data-action="tap" />
    <Button
      variant="primary"
      verb="BUY"
      target="WORKER"
      repeat
      onPress={() => {
        counts.refusing++;
        return counts.refusing > REFUSING_BUDGET ? refuse('cannot_afford') : OK;
      }}
      data-action="refusing"
    />
    <Button
      variant="primary"
      verb="BUY"
      target="WAREHOUSE"
      repeat
      disabled="needs 60 more food"
      onPress={count('disabled')}
      data-action="disabled"
    />
    <Button variant="secondary" verb="SKIP" onPress={count('secondary')} data-action="secondary" />
    <div class="narrow">
      <Button
        variant="primary"
        verb="ASSIGN"
        target="EVERY IDLE WORKER TO THE BROOD CHAMBER"
        onPress={count('long')}
        data-action="long"
      />
    </div>
  </>,
  document.getElementById('harness')!,
);
