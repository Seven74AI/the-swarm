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
- **PR flow:** branch → PR → it merges itself (squash) once CI is green. `.github/workflows/auto-merge.yml` arms
  auto-merge on every non-draft, non-fork PR, so don't arm it by hand; it needs the `AUTOMERGE_TOKEN`
  secret (also saved as a Dependabot secret). Dependabot PRs (`.github/dependabot.yml`, daily) are armed only for
  patch/minor updates. Dependabot raises no security alerts for pnpm 11 lockfiles, so
  `.github/workflows/audit-fix.yml` runs `pnpm audit` daily and opens a fix PR (`scripts/audit-fix.mjs`), and the
  `vitest` CI job fails on any high-severity production advisory (`pnpm audit --prod --audit-level=high`).
  The nightly sweep lands what auto-merge couldn't: it folds every stuck Dependabot PR (and audit leftovers) into one
  `claude/deps-consolidation-*` PR, and fixes up to 3 other stuck PRs (red CI, conflicts). It then adds the
  `automerge` label, which `auto-merge.yml` turns into armed auto-merge: see `docs/agents/pr-sweep.md`. Never merge through the REST merge endpoint; it can bypass the required checks.
  No approving review is required (owner decision, 2026-11-20), so CI is the only gate: never weaken a check
  to get a PR through. CI runs on every PR, docs-only included, because its checks are required.
  No direct pushes to `main`. If CI fails, fix the cause; don't retry-until-green.
- **Branch protection** requires the checks `typecheck`, `vitest`, `playwright-gate`. These are the
  job keys in `.github/workflows/ci.yml`: renaming a job (or giving it a job-level `name:`) silently breaks merging.
- **Pre-push hook** (`.githooks/pre-push`) runs typecheck + `vitest --changed`. `git push --no-verify` only if the hook itself is flaky.
- **Domain docs:** single-context repo — `CONTEXT.md` and `docs/decisions/` (ADRs, created lazily). See `docs/agents/domain.md`.
  Read the ADRs before proposing a new primitive, and record new primitives as an ADR.

## Planning with BMAD

BMAD Method v6 is installed (`_bmad/`, skills in `.claude/skills/`): core method (`bmad-*`) plus Game Dev Studio (`gds-*`).
Not sure which skill to use? Run `bmad-help`. **Plan in BMAD, build through GitHub issues:**

1. **Plan:** use the `gds-*` skills for game work (`gds-create-game-brief`, `gds-gdd`, `gds-game-architecture`,
   `gds-create-epics-and-stories`) and `bmad-*` for anything else. Artifacts go in `_bmad-output/planning-artifacts/`
   and are committed through a normal PR, so the plan is versioned with the code.
2. **Hand off:** each story becomes one GitHub issue. Title = story title; body = the acceptance criteria, testable as
   invariants, plus a link to the story file. Label it `needs-triage`. The owner promotes it to `ready-for-agent`.
3. **Build:** story issues (titles starting with `Story `) are built in order by the owner's run-all-stories session
   (`/goal`, `docs/agents/run-all-stories.md`), which treats the linked story file as the spec. The nightly sweep skips
   them and only takes other `ready-for-agent` issues.
   Don't run `gds-dev-story` / `gds-quick-dev` / `bmad-build` unattended. They don't follow the issue → PR → CI flow.
4. **Status lives in GitHub, not BMAD.** Don't maintain BMAD's sprint-status files. Open/closed issues are the truth.
   If a plan changes, update the artifact in a PR (`gds-correct-course`) and edit the affected issues.

**Target architecture:** `_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md`
(final) and the ADRs in `docs/decisions/`. Stories follow its structure, boundaries and patterns. The code still
uses vanilla DOM panels; Preact replaces them panel by panel (ADR 0004). Use the Context7 MCP, when available,
for current library docs (Vite 8, Preact 11, Vitest 5) before relying on memory.

Repo rules win over BMAD defaults: TDD, invariant tests, integer resources, `transitions.ts` as the only guard source,
and this file as the project context (don't generate a separate `project-context.md`). Update BMAD with
`npx bmad-method install --action quick-update --shims --set gds.primary_platform=other`. Keep `--shims`: the
gds skills still call the old `bmad-editorial-review-*` names, which only exist as shims. Keep
`gds.primary_platform=other` (no game engine). Leaving it out has turned the value into a JSON string. The Game Dev
module must be pinned (`--pin gds=<tag>`) where the GitHub API is unreachable. The owner's name is pinned in
`_bmad/custom/config.toml`, because the installer resets the team `user_name` to "BMad".

## Architecture gotchas

- **Signals track the signal, not object paths.** `gameState` (`src/state/gameSignal.ts`) is one
  `signal<GameState>`. `effect(() => { void gameState.value.prestige })` re-runs on EVERY write — every tick at 20 Hz —
  not only when `prestige` changes. To react to one slice, wrap it in `computed(() => gameState.value.prestige)`
  (notifies only when the reference changes). The UI reads only the `select*` slices in `src/state/selectors.ts`;
  panel effects read their selectors, then call `render()` inside `untracked()`. (#186)
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
