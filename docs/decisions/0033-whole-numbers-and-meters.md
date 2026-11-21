# 0033. Whole numbers for counts and costs; meters stay apart

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  Units and Integers · Story 3.3 (#283) · FR34, AR20

## Context

ADR 0028 made the rate-credited resources whole (`creditWhole`, `resourceRemainder`), but nothing checked the
rest. A property test over random ticks, actions and catch-ups found that a warehouse above Lv.5 gave a
fractional nest capacity (the soft cap divides it), so fractions of larvae matured into fractions of workers,
and the fraction stayed for the rest of the run. One cost in the balance data was a fraction
(Dark Matter Detection: 0.1 antimatter). Entropy, a 0–100 value that accumulates by fractions, sat beside the
resources with no rule saying what it is.

## Decision

- **Counts and costs are integers ≥ 0.** Every value in `state.resources` (and combat loot, soldiers) is whole
  after every step. Every cost in `data/balance/`, and every cost a system derives from one, is whole.
- **Effects that count things are floored.** `getEffects` floors `nestCapacity`, `scoutsCap` and `warriorsCap`
  after the soft cap; effects that scale (defense, poison) keep their fraction.
- **Meters are not resources.** Entropy lives in `state.entropy`, outside `state.resources`. It may hold a
  fraction, is shown rounded to a whole percent (`entropyMeter` in `EntropySystem.ts`, `selectEntropyMeter`) and
  is never a cost; only prestige resets it. A later meter follows the same rule.
- **Dark Matter Detection costs 1 antimatter.** The smallest whole amount; in practice the same gate, since a
  whole antimatter stock needed one unit on hand to pay 0.1.
- **Save v25** floors any fractional count an older save holds; a rate-credited stock folds its fraction into
  its carry, so nothing is lost there, and entropy is held to 0–100.

## Consequences

- `tests/unit/engine/integerResources.test.ts` (seeded property test) and `tests/unit/wholeCosts.test.ts`
  (balance scan, derived costs, count effects) are the contract. A new action joins the property test's command
  list; a new balance file is scanned automatically.
- Antimatter is still only produced by space missions and the Particle Lab conversion, which nothing builds
  yet (Story 3.6 owns that catch-22); the cost change does not make it worse.
