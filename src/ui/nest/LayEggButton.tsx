import type { ReadonlySignal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { selectEffectiveNestCapacity, selectStats, selectWorkers } from '../../state/selectors';
import type { LayMode } from '../../platform/settings';
import { formatInt } from '../../utils/format';
import { Button } from '../primitives/Button';
import { REPEAT_INTERVAL_MS } from '../primitives/holdRepeat';
import './nest.css';

/** How long a `+N` particle lives (its CSS float animation is shorter). */
export const PARTICLE_MS = 1000;
/** At most this many particles at once, so a held or toggled lay never piles them up. */
const MAX_PARTICLES = 6;

export interface LayEggButtonProps {
  /** Lays eggs: `actions.layEgg`. */
  lay: () => { readonly ok: boolean };
  /** `primary` on NEST in Phase 1; `secondary` in the scene area after it. */
  variant: 'primary' | 'secondary';
  /** The lay-mode setting (Phase 1): hold repeats, toggle starts and stops laying. Only the primary action toggles. */
  layMode?: ReadonlySignal<LayMode>;
}

interface Particle {
  readonly id: number;
  readonly text: string;
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
 */
export function LayEggButton({ lay, variant, layMode }: LayEggButtonProps) {
  const toggle = variant === 'primary' && layMode?.value === 'toggle';
  const cap = selectEffectiveNestCapacity.value;
  const atCapacity = cap > 0 && selectWorkers.value >= cap;
  const [laying, setLaying] = useState(false);
  const [particles, setParticles] = useState<readonly Particle[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const layRef = useRef(lay);
  layRef.current = lay;

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current.clear();
    },
    [],
  );

  function remove(id: number): void {
    setParticles((list) => list.filter((p) => p.id !== id));
  }

  function spawn(text: string): void {
    const id = nextId.current++;
    setParticles((list) => [...list, { id, text }].slice(-MAX_PARTICLES));
    const t = setTimeout(() => {
      timers.current.delete(t);
      remove(id);
    }, PARTICLE_MS);
    timers.current.add(t);
  }

  /** One lay through the action, with its `+N`. */
  function layOnce(): { readonly ok: boolean } {
    const before = selectStats.peek().totalEggsLaid;
    const result = layRef.current();
    if (result.ok) {
      const laid = Math.floor(selectStats.peek().totalEggsLaid - before);
      if (laid > 0) spawn(`+${formatInt(laid)} EGG`);
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
      />
      {particles.map((p) => (
        <span key={p.id} class="click-particle" aria-hidden="true" onAnimationEnd={() => remove(p.id)}>
          {p.text}
        </span>
      ))}
    </div>
  );
}
