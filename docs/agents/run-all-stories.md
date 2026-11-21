# Run all stories

The spec for a long, unattended session that builds every MVP story (issues #231–#318) one after another until none is left. The owner starts it; nightly sweeps keep following their own prompt.

## Starting a run

1. Open a Claude Code session on this repo and switch it to auto mode (goal turns don't approve tool calls on their own).
2. Set the goal:

```text
/goal Follow docs/agents/run-all-stories.md. Done when every open issue in Seven74AI/the-swarm whose title starts with "Story " and that is labelled ready-for-agent is either closed or relabelled ready-for-human. Prove it by running: gh api 'repos/Seven74AI/the-swarm/issues?state=open&labels=ready-for-agent&per_page=100' --jq '[.[] | select(.title|startswith("Story "))] | length' and showing it prints 0. Never weaken a CI check, never force-push, never merge a PR yourself.
```

If the session ends early, start a new one with the same goal: all state lives in GitHub, so it picks up from the lowest open story.

## Instructions for the agent

You are the autonomous developer for THE SWARM. The owner has started this session to build every MVP story, one after another, until none is left. Nobody is watching: don't ask questions. Decide, act, and write down what you decided in the PR or the issue.

### Setup (once per session)

1. Read CLAUDE.md (binding), AGENTS.md, CONTEXT.md, docs/agents/*.md, the ADRs in docs/decisions/ and the architecture in `_bmad-output/planning-artifacts/architecture/`. Source code is the only authority.
2. Run `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`, then `pnpm typecheck` and `pnpm test` on main. If the install fails (no network) or main is red and the cause isn't obvious to fix in its own PR, stop and report.
3. Use `gh api` (REST) for every GitHub operation (`gh issue` / `gh pr` use GraphQL, which is blocked). See docs/agents/issue-tracker.md.
4. Readiness check, first session only: if `_bmad-output/planning-artifacts/implementation-readiness-report*.md` doesn't exist on main, run the `gds-check-implementation-readiness` skill. Fix any contradiction it finds in a docs-only PR (through `gds-correct-course` if it changes the plan), edit the affected issues to match, and wait for that PR to merge before step 5.

### The queue

The stories are the open issues titled `Story <epic>.<n>: …` (#231–#318), each linking its spec section in `_bmad-output/planning-artifacts/epics.md`. That section is the spec; the issue body is a copy of it.

Build order is the issue number, ascending (Epic 1 → 2 → 3 → 4 → 5, then Epic 8; Epic 8 stories may be taken earlier, but only once Stories 1.5, 1.7, 1.15 and 1.22 are closed). Every story builds on the ones before it, so work strictly **one story at a time**: don't start the next until the current PR has merged.

5. Pick the lowest-numbered open story issue that is labelled `ready-for-agent`, has no open PR referencing it, and has no `ready-for-human` label. If none is left, go to Report.
6. For that issue:
   1. Read the issue, its comments and its spec section. Check whether main already implements it. If it does, comment with the evidence (files and lines), close it, and go back to step 5.
   2. If the story needs new content or tuning (events, upgrades, narrative lines, balance values), design it yourself within the story's constraints (owner decision #31 in the GDD decision log). Don't send it back for a decision. List every addition in the PR body with the pillar it serves.
   3. Only if the story genuinely can't be built as written (it contradicts the code, the architecture or an earlier story in a way you can't resolve inside the story's intent), comment what's wrong, swap `ready-for-agent` for `ready-for-human`, and move on to the next story that doesn't depend on it. If every remaining story depends on it, stop and report.
   4. Create `claude/issue-<n>-<slug>` from the latest main. TDD: write the failing test first and run it to see it fail, then implement until it passes. Test invariants, never balance numbers (import values from `data/balance/` when a test needs one). Integers only. One spread-based state write per tick, never mutate in place. Keep existing `data-*` / `id` selectors when migrating UI. A new save field gets a numbered migration step; never renumber.
   5. Before pushing, run `pnpm typecheck`, `pnpm lint`, `pnpm test` and the Playwright specs the change touches (all of them if it changes the shell, phase flow or saves). All must pass.
   6. Push and open a non-draft PR against main with `Closes #<n>`, a short summary, how it was tested, and any decisions you made. Don't arm auto-merge: `.github/workflows/auto-merge.yml` does it, and the PR merges itself once `typecheck`, `vitest` and `playwright-gate` are green.
   7. Wait for the PR to merge, checking its state and check runs every few minutes with a tool call (a goal loop stops if turns pass without tool use). If a check fails, read the logs, fix the real cause and push again. Never weaken, skip or quarantine a test; never add `|| true` or `--if-present`; never touch branch protection or the required checks. After 3 failed fix attempts, comment what's failing, swap `ready-for-agent` for `ready-for-human`, and continue with step 5.
   8. Once merged, confirm the issue closed (close it with a comment linking the PR if it didn't), then go back to step 5.
7. After every 5 merged stories, post a one-line progress comment on the newest merged PR (`N of 88 stories done; next: #<n>`), so the owner can follow from GitHub.

### Hard limits

Never force-push, never push to main, never merge a PR yourself (never call `PUT /pulls/<n>/merge`), never change repo settings or branch protection. Edit `.github/workflows/` only when the story is about CI (Story 1.35), and then only by adding a step inside an existing job. Don't run `gds-dev-story`, `gds-quick-dev` or `bmad-build`; they bypass the issue → PR → CI flow. Don't create stories for Epics 6 or 7; they're written after the MVP playtest.

### Long sessions

All state lives in GitHub (open/closed issues, open PRs), so nothing needs remembering across a context reset or compaction. Before each new story, re-read the issue list rather than relying on memory.

### Report

When the queue is empty or the run stops, end with: stories merged in this session (issue → PR links), stories sent to `ready-for-human` and why, anything blocked, and the next story in the queue.
