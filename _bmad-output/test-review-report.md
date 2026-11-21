# Test Review Report: the-swarm

**Review Date**: 2026-11-21
**Reviewer**: Claude (gds-test-review, Game QA Lead), for Seven74
**Period Covered**: Snapshot of `main` at `8d3b2de` (2026-11-21 13:43 UTC). CI run history could not be read from this session (no GitHub API access), so trends are not available.
**Scope**: full

---

## Executive Summary

### Overall Health: Good

The suite is large, fast, green and well guarded by CI. The problems are about discipline, not missing coverage: hard waits in E2E, a few tests that break the repo's own testing rules, and unit tests that pin balance numbers.

### Key Findings

1. **Everything passes.** 2,225 Vitest tests (unit + architecture) and 350 Playwright tests all passed. The E2E run used CI settings (retries=2) and needed **zero retries**. Line coverage is 94.5% and branch coverage 86.5%.
2. **80 hard waits (`page.waitForTimeout`) in E2E**, about **113 s of fixed sleep** in total. `prestige-integration.spec.ts` alone has 20. These are the main flake risk and the main cost in the slowest tests.
3. **Four places break CLAUDE.md testing rules:** a conditional `test.skip` (`tab-shell.spec.ts:116`) and three guarded assertions (`accessibility.spec.ts:314`, `:328`, `text-reflow.spec.ts:252`). Each one passes silently when the element it checks is gone.
4. **Balance numbers are pinned in unit tests.** There are about 76 numeric `toBe(N)` assertions in `*System` tests (about 172 across the unit tests). For example, `ResearchSystem.test.ts:56-75` pins costs, researcher counts and durations. One of those pins, `antimatter: 0.1` (`src/systems/ResearchSystem.ts:42`), locks in a **fractional resource cost**, which breaks the integer-resources rule.
5. **The mobile-first game is tested only on Desktop Chrome.** Playwright has one `Desktop Chrome` project, and phone sizes are simulated with `setViewportSize`. No test uses `hasTouch`/`tap()`, so touch input is untested. There are no performance or tick-budget tests either.

### Recommended Actions

1. Fix the 4 rule violations by seeding state so the element must exist, and fix the misleading combat test name.
2. Replace `waitForTimeout` with `expect.poll` / web-first assertions / `page.clock`, starting with `prestige-integration.spec.ts`.
3. Turn the balance-number pins into invariants and open an issue for the fractional antimatter cost.
4. Add a mobile Playwright project (`devices['Pixel 7']` or similar, with `hasTouch`) for a smoke subset.

---

## Test Suite Metrics

### Test Distribution

| Type                                 | Count     | % of Total | Files |
| ------------------------------------ | --------- | ---------- | ----- |
| Unit Tests (Vitest, jsdom)           | 2,172     | 84.3%      | 169   |
| Build test (Vitest, forks)           | 1         | <0.1%      | 1     |
| Architecture / static (`tests/arch`) | 52        | 2.0%       | 4     |
| E2E / Functional (Playwright)        | 350       | 13.6%      | 46    |
| Performance Tests                    | 0         | 0%         | 0     |
| **Total**                            | **2,575** | 100%       | 220   |

Compared with the guideline pyramid (70/25/5), E2E is heavier than recommended. That is reasonable for a DOM-driven web game, and the E2E tier is fast enough to afford.

### Execution Metrics (this review's run)

| Metric                    | Current                                                    | Previous | Trend |
| ------------------------- | ---------------------------------------------------------- | -------- | ----- |
| Pass Rate                 | 100% (2,575 / 2,575)                                       | n/a      | →     |
| Vitest wall time          | 90 s (with v8 coverage)                                    | n/a      | →     |
| Playwright wall time      | 299 s (4 workers, unsharded; CI splits it into 2 shards)   | n/a      | →     |
| E2E mean / slowest test   | 3.3 s / 21.5 s                                             | n/a      | →     |
| Flaky Tests (this run)    | 0                                                          | n/a      | →     |
| Disabled / skipped        | 0 static skips; 1 conditional skip (did not fire)          | n/a      | →     |

### Coverage (Vitest v8, `src/**`)

| Statements | Branches | Functions | Lines  |
| ---------- | -------- | --------- | ------ |
| 92.96%     | 86.52%   | 94.13%    | 94.53% |

Lowest-covered files: `src/ui/AudioSystem.ts` (31% lines), `src/ui/gameViews.tsx` (44%), `src/ui/panels/MapPanel.ts` (66%, canvas drawing), `src/ui/shell/Shell.tsx` (74%, ResizeObserver layout effect), `src/ui/front/LegacyPanel.tsx` (76%). Most of these are code jsdom can't run (canvas, ResizeObserver, Web Audio), and the composition code is exercised by E2E.

### Recent Run History

| Date       | Passed | Failed | Skipped | Duration       |
| ---------- | ------ | ------ | ------- | -------------- |
| 2026-11-21 | 2,575  | 0      | 0       | 90 s + 299 s   |

Earlier CI and `flake-hunt.yml` history was not accessible. Next review: pull the last 10 nightly flake-hunt results.

---

## Quality Assessment

### Strengths

- **Architecture tests as ratchets.** `tests/arch/architecture.test.ts` keeps a shrink-only `Math.random` allowlist for `systems/`, and also guards offline caps, voice and goal thresholds. `tests/unit/ciConfig.test.ts` guards the CI config itself.
- **Save/load is the best-tested area.** This includes `saveFixtures` (91 tests), `saveCompatibility` (50), `migrations` (38), `SaveManager` (26), `saveLoadStatus`, and the E2E specs `unreadable-save`, `resume-path` and `continue`. Data loss is the P0 risk for an idle game, and it is covered thoroughly.
- **Property-based tests** with fast-check (`property.test.ts` and 2 others).
- **Accessibility is automated:** axe on every tab, reduced-motion, 44 px targets and reflow (`accessibility.spec.ts`, `text-reflow.spec.ts`).
- **Combat RNG is handled correctly in E2E:** tests assert `VICTORY|DEFEAT|DRAW` rather than a specific outcome.
- **Fast, isolated unit runner.** The `vmThreads` pool gives each file fresh modules, and no single file takes more than 1.6 s.
- **No `.only` and no static `.skip`.** `forbidOnly` is on in CI.

### Issues Found

| Issue                                        | Severity | Count     | Example                                                                         | Recommended Fix                                                                                     |
| -------------------------------------------- | -------- | --------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Hard-coded waits                             | High     | 80 (~113 s) | `prestige-integration.spec.ts:101` `waitForTimeout(1500)`                     | `expect.poll(() => readState(page)).toBeGreaterThan(before)`; `page.clock.pauseAt` + `runFor()` for time |
| Conditional skip (breaks CLAUDE.md)          | High     | 1         | `tab-shell.spec.ts:116` `test.skip(max < 40, …)`                                | Seed enough content (or a smaller viewport) so WRKR must scroll; `expect(max).toBeGreaterThanOrEqual(40)` |
| Guarded assertions (breaks CLAUDE.md)        | High     | 3         | `accessibility.spec.ts:314` `if ((await particle.count()) > 0) expect(…)`      | Assert the element exists first, or assert its absence explicitly if that's the reduced-motion contract |
| Balance numbers pinned                       | Medium   | ~76 in `*System` tests | `ResearchSystem.test.ts:58` `expect(vcs.cost.stone).toBe(500)`     | Assert invariants: cost > 0, integer, later tiers cost more, prerequisite chain holds               |
| Test pins a fractional resource cost         | Medium   | 1         | `ResearchSystem.test.ts:73` `toBe(0.1)` for antimatter (`ResearchSystem.ts:42`) | Open an issue: costs must be integers. Replace the pin with an "all costs are integers" invariant  |
| Spec constants restated in tests             | Low      | several   | `EntropySystem.test.ts:224` `expect(ENTROPY_MAX).toBe(100)`                     | Delete, or assert the behavior the constant drives                                                  |
| Misleading test name                         | Low      | 1         | `combat-edges.spec.ts:277` "strong equipment favors victory" asserts any outcome | Rename to "battle with strong equipment resolves", or test the bias in a unit test with a seeded rng |
| Setup-only DOM reset (no `afterEach`)        | Low      | 3         | `bootMountsApp.test.ts:9` sets `document.body.innerHTML` and never clears it    | Add `afterEach` cleanup, as CLAUDE.md requires for the shared jsdom                                 |

### Anti-Patterns Detected

| Pattern                                    | Occurrences | Impact                                                               | Fix Effort |
| ------------------------------------------ | ----------- | -------------------------------------------------------------------- | ---------- |
| `waitForTimeout` fixed sleeps              | 80          | Flake risk on slow runners, plus ~113 s of dead time per E2E run     | Medium     |
| Assertion guarded by presence check        | 4           | Test passes when the feature is deleted                              | Low        |
| Implementation numbers instead of invariants | ~76–172   | Every rebalance breaks tests; hides real rule violations (antimatter 0.1) | Medium |
| Name/assertion mismatch                    | 1           | False sense of coverage for combat balance                           | Low        |

---

## Coverage Analysis

Priorities follow `knowledge/test-priorities.md`. P0 = the game can't start, the core loop is broken, or data is lost.

### Feature Coverage Matrix

| Feature                                    | P0 Tests                                                       | P1 Tests                                                    | P2 Tests                         | Gap?                                  |
| ------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------- | ------------------------------------- |
| Boot / game start                          | `bootMountsApp`, `game.spec`, `TickFailureHalt`, `tick-failure.spec` | `GameLoop`, `Ticker`                                   | `debug/*`                        | No                                    |
| Core loop (eggs → larvae → workers)        | `ResourceSystem`, `actions`, `nest-tab.spec`, `golden-path.spec` | `worker-management.spec`, `nest-capacity-ui.spec`         | `particles-tween.spec`           | No                                    |
| Save / Load / Migrations                   | `saveFixtures`, `saveCompatibility`, `migrations`, `unreadable-save.spec` | `resume-path.spec`, `continue.spec`               | `saveLoadStatus`                 | No                                    |
| Offline progression                        | `OfflineResourceComputation`, `offlineCap` (unit + arch)        | `offline-progression.spec`                                  | `OfflineAutoEggLayer`            | No                                    |
| Phase progression (guards in `transitions.ts`) | `phases` (49), `PhaseStateMachine`                          | `phase-transition.spec`, `golden-path.spec`                 | `phase-tokens.spec`              | No                                    |
| Combat                                     | `BattleSystem`, `SoldierSystem`, `combat.spec`                 | `combat-edges.spec`, `front-war.spec`                       | `EventLogCombat`                 | Minor: equipment bias untested (RNG)  |
| Expansion / Map / Territory                | `TerritorySystem`, `MapPanel`, `Phase3Integration`             | `phase3-expansion.spec` (panel visible only)                | `ExpeditionSystem`               | **Yes: no E2E tile-tap → claim**      |
| Research / Conversion                      | `ResearchSystem`, `ResourceConversionSystem`                   | `research.spec`                                             | —                                | Integer-cost invariant missing        |
| Space                                      | `SpaceshipSystem` (47)                                         | `space-phase.spec`, `starmap-click.spec`                    | `planets`                        | No                                    |
| Prestige / Transcendence                   | `PrestigeSystem` (55), `PrestigeBonusSystem`                   | `prestige.spec`, `prestige-integration.spec`, `transcendence-victory.spec` | `EntropySystem`, `entropy.spec` | No (but heaviest hard-wait user) |
| UI shell / tabs / sheets                   | `ui/shell` (17 files)                                          | `tab-shell.spec`, `sheets.spec`, `resource-strip.spec`      | `shortcuts.spec`, `desktop-layout.spec` | No                             |
| Accessibility                              | —                                                              | `accessibility.spec` (axe), `text-reflow.spec`              | `ui/a11y` unit                   | Guarded asserts (see Issues)          |
| Audio                                      | —                                                              | —                                                           | `AudioSystem.test` (6)           | Yes (P3): 31% line coverage           |
| Mobile / touch platform                    | —                                                              | viewport-resized specs (14 files)                           | —                                | **Yes: no touch/mobile device project** |
| Performance (tick budget, long sessions)   | —                                                              | —                                                           | `debug/timings`                  | Yes (P2)                              |
| Multiplayer                                | n/a                                                            | n/a                                                         | n/a                              | n/a                                   |

### Critical Gaps

| Gap                                                    | Risk   | Impact if it breaks                                         | Priority to Fix |
| ------------------------------------------------------ | ------ | ----------------------------------------------------------- | --------------- |
| No touch / mobile-device E2E for a mobile-first game   | High   | Tap, hold or scroll regressions reach phone players unseen  | P1              |
| No E2E for tapping a map tile to claim it              | Medium | The `onTileClick` wiring (a known gotcha) could regress silently | P1         |
| No "all costs are integers" invariant across data      | Medium | Fractional resources creep in (one exists already)          | P1              |
| No tick-time / long-session performance check          | Medium | Late-game slowdown at 20 Hz on low-end phones               | P2              |
| Audio largely untested                                 | Low    | Missing or overlapping sounds                               | P3              |

### Coverage by Priority (judged from the matrix above)

```
P0 Coverage: ~100% ██████████
P1 Coverage:  ~85% ████████▌░
P2 Coverage:  ~70% ███████░░░
P3 Coverage:  ~40% ████░░░░░░
```

---

## Infrastructure Review

### CI/CD Integration

| Aspect            | Status | Notes                                                                                                           |
| ----------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| Tests in CI       | ✅     | `typecheck`, `vitest` (+ `pnpm audit --prod`), `playwright` ×2 shards → `playwright-gate`                       |
| Results visible   | ✅     | Playwright HTML report uploaded per shard (30 days)                                                             |
| Failures block    | ✅     | Required checks gate auto-merge; pre-push hook runs typecheck + `vitest --changed`                              |
| Nightly runs      | ✅     | `flake-hunt.yml` runs E2E ×3 with no retries. Turning a failure into an issue is a manual step                  |
| Performance tests | ❌     | None                                                                                                            |
| Coverage tracked  | ❌     | `@vitest/coverage-v8` is configured but not run in CI, and there is no threshold                                |

On PRs, `retries: 2` lets a flaky E2E test pass on retry. Playwright marks it "flaky" but the job stays green. The nightly flake-hunt is the only place flakes surface.

### Test Infrastructure Quality

| Component      | Quality | Notes                                                                                                   |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Fixtures       | Good    | `saveFixtures`, `createInitialState()` overrides, pipeline-aware seeds                                  |
| Helpers        | Good    | `tests/e2e/helpers/` (`reveal.ts` `settleReveals`, `phase.ts`, `resources.ts`). Hard waits show they aren't used everywhere |
| Data factories | Fair    | Several E2E specs (e.g. `combat.spec`, `combat-edges.spec`) build full seed objects inline              |
| Documentation  | Good    | The "Testing gotchas" section in CLAUDE.md is specific and current                                      |

### Maintenance Burden

- Test update frequency: **medium**. Balance pins force test edits on every rebalance.
- Brittleness score: **medium**, driven by hard waits and pinned numbers.
- Developer friction: **low**. The suites are fast and the rules are documented.

---

## Recommendations

### Immediate (This Sprint)

| Action                                                                                                         | Effort | Impact | Owner |
| -------------------------------------------------------------------------------------------------------------- | ------ | ------ | ----- |
| Replace the conditional skip in `tab-shell.spec.ts:116` with seeded content + assertion                        | 1 h    | High   | agent |
| Remove the presence guards in `accessibility.spec.ts:314,328` and `text-reflow.spec.ts:252`                    | 1–2 h  | High   | agent |
| Open an issue: `darkMatterDetection` costs `0.1` antimatter (integer rule). Add an "every cost is an integer" data invariant | 2 h | High | human triage → agent |
| Rename or fix the "strong equipment favors victory" test                                                       | 15 min | Low    | agent |

### Short-term (This Milestone)

| Action                                                                                                           | Effort | Impact | Owner |
| ---------------------------------------------------------------------------------------------------------------- | ------ | ------ | ----- |
| Remove `waitForTimeout`, starting with `prestige-integration` (20), `combat-edges` (9), `pause` (8), `narrative-events` (6) | 2–3 d | High | agent |
| Add a lint/arch check that only lets the `waitForTimeout` count shrink (same ratchet as `KNOWN_MATH_RANDOM`)     | 2 h    | Medium | agent |
| Add a mobile Playwright project (`hasTouch`, phone device) running a smoke subset: golden path, tab shell, nest tap/hold | 1 d | High | agent |
| Add an E2E test for tapping a map tile to claim it in expansion                                                  | 2 h    | Medium | agent |
| Convert `ResearchSystem` / `EntropySystem` balance pins into invariants                                          | 1 d    | Medium | agent |

### Long-term (Ongoing)

| Action                                                                                             | Effort | Impact | Notes                                                       |
| -------------------------------------------------------------------------------------------------- | ------ | ------ | ----------------------------------------------------------- |
| Tick-budget test: a late-game seeded state must tick in < N ms (measured, with headroom)           | 2–3 d  | Medium | Use `debug/timings`; a nightly job, not a PR gate           |
| Have flake-hunt open a `needs-triage` issue automatically on failure                               | 0.5 d  | Medium | The workflow comment already asks for this                  |
| Run coverage in CI and add a ratchet threshold (never lower than current)                          | 0.5 d  | Medium | Start from 94% lines / 86% branches                         |
| Shared E2E seed factory (`seedPhase('combat', overrides)`) to replace inline seeds                 | 1–2 d  | Medium | Keeps seeds in line with `transitions.ts` guards            |

---

## Appendices

### Appendix A: Flaky Tests

| Test Name                           | Failure Rate     | Failure Pattern | Fix Priority |
| ----------------------------------- | ---------------- | --------------- | ------------ |
| None observed in this run (0 retries) | 0/350          | —               | —            |

Highest flake risk (most fixed sleeps): `prestige-integration.spec.ts`, `combat-edges.spec.ts`, `pause.spec.ts`, `narrative-events.spec.ts`, `worker-management.spec.ts`. Check the last 10 `flake-hunt.yml` runs to confirm.

### Appendix B: Slow Tests

None is over the 30 s threshold. Slowest E2E tests:

| Test Name                                                                      | Duration | Type | Action                         |
| ------------------------------------------------------------------------------ | -------- | ---- | ------------------------------ |
| prestige-integration › starting resources and phase skip apply after prestige  | 21.5 s   | E2E  | optimize (replace sleeps)      |
| prestige-integration › multiple prestiges compound bonuses correctly           | 18.0 s   | E2E  | optimize (replace sleeps)      |
| accessibility › every tab passes axe (×2 sizes)                                | 17.0 s   | E2E  | keep (axe is inherently slow)  |
| prestige-integration › auto-egg-layer sustains egg production after prestige   | 16.0 s   | E2E  | optimize (use `page.clock`)    |
| text-reflow › every tab fits the screen (×5 sizes)                             | 11–15 s  | E2E  | keep                           |
| worker-management › assign worker to Gather increases food over time           | 12.1 s   | E2E  | optimize (`expect.poll`)       |
| golden-path › save and reload preserves complex state                          | 11.3 s   | E2E  | keep                           |

Slowest Vitest file: `tests/arch/architecture.test.ts` (1.6 s).

### Appendix C: Disabled Tests

| Test Name                                                                  | Disabled Since | Reason                                         | Action                   |
| -------------------------------------------------------------------------- | -------------- | ---------------------------------------------- | ------------------------ |
| tab-shell › each tab keeps its scroll position… (conditional `test.skip`)  | —              | Skips when the WRKR tab doesn't overflow       | Fix: seed it to overflow |

### Appendix D: Technical Debt

| Item                       | Description                                                              | Effort | Priority |
| -------------------------- | ------------------------------------------------------------------------ | ------ | -------- |
| Hard waits                 | 80 `waitForTimeout` calls, ~113 s                                        | 2–3 d  | P1       |
| Balance pins               | ~76 numeric assertions in `*System` tests                                | 1 d    | P2       |
| Inline E2E seeds           | Large hand-built saves duplicated across combat specs                    | 1–2 d  | P2       |
| Low-coverage UI modules    | `AudioSystem.ts`, `gameViews.tsx`, `LegacyPanel.tsx` (the Preact migration, ADR 0004, may retire some) | — | P3 |

---

## Next Review

**Scheduled**: 2026-12-21 (monthly full review)
**Focus Areas**: hard-wait count, mobile project in place, flake-hunt history, integer-cost invariant.
**Success Criteria**: 0 conditional skips or guarded assertions; `waitForTimeout` count < 20 and ratcheted; a mobile smoke project in CI; no fractional costs in data.

---

**Checklist** (`checklist.md`): all sections are covered. Caveats: pass-rate history and trends need CI access, and flakiness was judged from one CI-mode run plus a static scan.
**Completed by:** Claude · **Date:** 2026-11-21 · **Tests Reviewed:** 2,575
