/**
 * E2E harness for the Story 1.12 primitives. They aren't on a game screen yet,
 * so Playwright drives them here with the real tokens and styles. Dev server only.
 * The coach-mark memory is a stand-in for the settings store main passes in.
 */
import '../../../src/ui/styles/tokens.css';
import '../../../src/ui/styles/typography.css';
import '../../../src/ui/styles/base.css';
import '@preact/signals';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { Stepper } from '../../../src/ui/primitives/Stepper';
import { Card } from '../../../src/ui/primitives/Card';
import { Meter } from '../../../src/ui/primitives/Meter';
import { ToastHost, createToasts } from '../../../src/ui/primitives/Toast';
import { CoachMark } from '../../../src/ui/primitives/CoachMark';
import { Button } from '../../../src/ui/primitives/Button';

const AVAILABLE = 30;
const w = window as unknown as Record<string, unknown>;
w.__available = AVAILABLE;
const outside = { clicks: 0 };
w.__outside = outside;
document.addEventListener('click', () => outside.clicks++);

const seen = signal({ coachMarksSeen: [] as readonly string[] });
w.__seen = seen;
const memory = { settings: seen, update: (p: { coachMarksSeen: readonly string[] }) => (seen.value = p) };
const toasts = createToasts();
w.__toast = (t: string) => toasts.show(t);

function App() {
  const [value, setValue] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  return (
    <>
      <Stepper
        value={value}
        available={AVAILABLE}
        onStep={(d) => setValue((v) => v + d)}
        addLabel={(n) => (n === 1 ? 'Add one gatherer' : `Add ${n} gatherers`)}
        removeLabel={(n) => (n === 1 ? 'Remove one gatherer' : `Remove ${n} gatherers`)}
        addDisabled="no free workers"
        data-role="gatherer"
      />
      <Meter label="Gatherers" value={value} max={AVAILABLE} valueText={`Gatherers ${value} of ${AVAILABLE}`} />
      <Card
        id="nursery"
        title="NURSERY"
        effect="+1 larva slot"
        cost="20 FOOD"
        affordable={value >= 20}
        shortfall={{ amount: 20 - value, glyph: '△' }}
        action={<Button verb="BUILD" onPress={() => {}} data-action="build" />}
      />
      <div
        ref={(el) => {
          const btn = (el?.firstElementChild as HTMLElement | null) ?? null;
          if (btn && btn !== target) setTarget(btn);
        }}
      >
        <Button variant="primary" verb="LAY" target="EGG" onPress={() => {}} data-action="lay" />
      </div>
      <CoachMark concept="lay-egg" text="Tap to lay an egg." target={target} memory={memory} />
      <ToastHost toasts={toasts} />
    </>
  );
}

render(<App />, document.getElementById('harness')!);
