# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

THE SWARM is an incremental/idle web game (ant queen → colony → combat → expansion → space → transcendence).
TypeScript + Vite, `@preact/signals-core`, vanilla DOM panels, Vitest + Playwright, **pnpm** (not npm).
Live: https://seven74ai.github.io/the-swarm/ (GitHub Pages, deploys on push to `main`).

## Ground rules

- **Source code is the only authority.** Docs drift; check the code before citing a number.
  Phase guards live only in `src/phases/transitions.ts`. `docs/UNLOCKS.md` is stale.
- **TDD is mandatory.** Write the failing test first.
- **Test invariants, never balance numbers.** `expect(eggs).toBeLessThan(before)`, not `toBe(9)`.
- **All resources are integers** — `Math.floor()` every computed amount.
- **One spread-based state write per tick.** Never mutate state in place.
- **Never force-push. Never add `|| true` or `--if-present` to CI steps.**
- Before starting an issue, check whether the code already implements it — the tracker has lagged behind the code before.

## Commands

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run (unit)
pnpm test:e2e     # playwright test
pnpm test:all     # typecheck + unit + e2e
pnpm lint         # oxlint
pnpm build        # tsc && vite build
```

If `pnpm install` cannot reach the registry (network access off), no tests can run, so TDD is impossible. Stop and say so rather than pushing untested code.

## Workflow

- **Issues:** GitHub Issues on `Seven74AI/the-swarm`. See `docs/agents/issue-tracker.md`.
- **Triage labels:** `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
  Implement only `ready-for-agent` issues unattended. Stop on the other labels.
- **PR flow:** branch → PR → enable auto-merge (squash) → it merges itself once CI is green. No approving review is
  required (owner decision, 2026-11-20), so CI is the only gate: never weaken a check to get a PR through.
  No direct pushes to `main`. If CI fails, fix the cause; don't retry-until-green.
- **Branch protection** requires the checks `typecheck`, `vitest`, `playwright-gate`. These are the
  job keys in `.github/workflows/ci.yml`: renaming a job (or giving it a job-level `name:`) silently breaks merging.
- **Pre-push hook** (`.githooks/pre-push`) runs typecheck + `vitest --changed`. `git push --no-verify` only if the hook itself is flaky.
- **Domain docs:** single-context repo — `CONTEXT.md` and `docs/decisions/` (ADRs, created lazily). See `docs/agents/domain.md`.
  Read the ADRs before proposing a new primitive, and record new primitives as an ADR.

## Architecture gotchas

- **Signals track the signal, not object paths.** `gameState` (`src/state/gameSignal.ts`) is one
  `signal<GameState>`. `effect(() => { void gameState.value.prestige })` re-runs on EVERY write — every tick at 20 Hz —
  not only when `prestige` changes. To react to one slice, wrap it in `computed(() => gameState.value.prestige)`
  (notifies only when the reference changes) or keep a hash/dirty check. (#186)
- **Pipelines** (`eggPipeline`, `larvaPipeline`, `soldierPipeline`) are rate-based `{ count, progress }`.
  When one feeds another, every exit must increment the next pipeline's `count`, or items vanish.
- **Two soldier systems — don't conflate.** Combat soldiers (`SoldierSystem`, `state.combatSoldiers`, pipeline,
  auto-battles) vs scouts/warriors (`RecruitmentSystem`, `state.soldiers.*`, direct recruit, expeditions only; caps from `getEffects('barracks', level)` — scouts from Lv.1, warriors from Lv.2).
- **`TerritorySystem.claimTile()` mutates in place** — spread the state before writing it back.
- **`MapPanel.onTileClick` defaults to `null`** — assign it explicitly in `UIRoot`.
- **`getEffectiveNestCapacity()` does not exist.** Compute
  `s.resources.nestCapacity + (getEffects('warehouse', s.buildings.warehouse.level).nestCapacity ?? 0)`.
- **Save migrations** (`src/persistence/migrations.ts`, version in `SaveManager.SAVE_VERSION`): if two branches add the
  same version step, merge them into one function at that version — never renumber.
- **No catch-22 resources:** anything a feature consumes must be producible before that feature unlocks.

## Testing gotchas

- **E2E seeding:** `page.addInitScript(() => localStorage.setItem('the_swarm_save', JSON.stringify(data)))` BEFORE
  `page.goto('/')` — the `beforeunload` autosave overwrites anything set after load.
- **Seeds must be pipeline-aware:** eggs go in `eggPipeline.count`, larvae in `larvaPipeline.count`.
- **Phase seeds must satisfy the real guards** in `transitions.ts`, or the panel never appears.
- Build seeds from `createInitialState()` overrides; `SaveManager.load()` migrates + deep-merges partial saves.
- Combat RNG is unseeded: assert `Victory|Defeat`, never a specific outcome.
- rAF fake timers don't reliably drive `Ticker`; test the public API, not tick counts.
- Panels exist but are `display:none` until their phase — use `toBeVisible()`.
- Selectors: grep `src/ui/panels/*.ts` for `data-` / `id=`; there is no canonical selector list.
