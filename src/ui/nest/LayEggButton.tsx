import type { ReadonlySignal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { selectEffectiveNestCapacity, selectStats, selectWorkers } from '../../state/selectors';
import type { LayMode } from '../../platform/settings';
import { Button } from '../primitives/Button';
import { REPEAT_INTERVAL_MS } from '../primitives/holdRepeat';
import { Floats, useFloats } from '../primitives/floats';
import { feelBalance } from '../../data/balance/feel';
import './nest.css';

/** How long a `+N` particle lives (its CSS float animation is shorter). */
export const PARTICLE_MS = feelBalance.floatLifeMs;

export interface LayEggButtonProps {
  /** Lays eggs: `actions.layEgg`. */
  lay: () => { readonly ok: boolean };
  /** `primary` on NEST in Phase 1; `secondary` in the scene area after it. */
  variant: 'primary' | 'secondary';
  /** The lay-mode setting (Phase 1): hold repeats, toggle starts and stops laying. Only the primary action toggles. */
  layMode?: ReadonlySignal<LayMode>;
}

/**
 * LAY EGG (Story 1.22; FR1, FR41, UX-DR18). It replaces the legacy
 * ClickButton and keeps its hooks: `#click-egg` on the button,
 * `.click-button-at-capacity` while the nest is full, `.click-particle` for
 * each `+N` that floats up.
 *
 * Every lay goes through the action (`actions.layEgg`), which raises
 * `egg_clicked` after its write: main plays the light haptic, the key click
 * and the rate-limited save from that event. The particle is this button's
 * visual response.
 *
 * Hold repeats at the hold-repeat rate (`holdRepeat.ts`). In toggle lay mode
 * the primary action toggles instead: one tap starts laying at
 * `REPEAT_INTERVAL_MS` (the same rate), the next tap stops it
 * (`[data-laying]`).
 *
 * Game feel (Story 8.9): the `+N` types in next to EGG, at most
 * `feelBalance.floatMaxPerSec` times a second (`useFloats`; faster lays add
 * up into the next `+N`). The button is `data-feel="lay"`, not `press`: each
 * lay's `egg_clicked` already plays the light tick.
 */
export function LayEggButton({ lay, variant, layMode }: LayEggButtonProps) {
  const toggle = variant === 'primary' && layMode?.value === 'toggle';
  const cap = selectEffectiveNestCapacity.value;
  const atCapacity = cap > 0 && selectWorkers.value >= cap;
  const [laying, setLaying] = useState(false);
  const floats = useFloats();
  const layRef = useRef(lay);
  layRef.current = lay;

  /** One lay through the action, with its `+N`. */
  function layOnce(): { readonly ok: boolean } {
    const before = selectStats.peek().totalEggsLaid;
    const result = layRef.current();
    if (result.ok) {
      const laid = Math.floor(selectStats.peek().totalEggsLaid - before);
      if (laid > 0) floats.spawn(laid);
    }
    return result;
  }

  const running = toggle && laying;
  useEffect(() => {
    if (!running) return;
    if (!layOnce().ok) {
      setLaying(false);
      return;
    }
    const t = setInterval(() => {
      if (!layOnce().ok) setLaying(false);
    }, REPEAT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [running]);

  return (
    <div
      class="lay-egg click-button-container"
      data-lay-egg={variant}
      data-lay-mode={toggle ? 'toggle' : 'hold'}
      data-laying={running ? 'true' : 'false'}
    >
      <Button
        id="click-egg"
        className={atCapacity ? 'lay-egg__button click-button-at-capacity' : 'lay-egg__button'}
        variant={variant}
        verb="LAY EGG"
        target={running ? '[ON]' : undefined}
        repeat={!toggle}
        onPress={toggle ? () => setLaying((on) => !on) : layOnce}
        data-action="lay-egg"
        data-feel="lay"
      />
      <Floats floats={floats.list} unit="EGG" className="click-particle" />
    </div>
  );
}
