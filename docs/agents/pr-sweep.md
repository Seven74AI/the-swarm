# Stuck-PR pass (nightly sweep)

The nightly Claude sweep runs this pass **before** the `ready-for-agent` issue queue. Its job is to land open PRs
that auto-merge couldn't: Dependabot majors, red CI, merge conflicts, and vulnerabilities the daily audit couldn't
fix on its own. CI stays the only gate. The sweep never merges a PR itself; it fixes the PR, then lets GitHub merge
it once the required checks (`typecheck`, `vitest`, `playwright-gate`) pass.

Owner decisions (2026-11-21):
- The sweep fixes stuck PRs, Dependabot **majors** included, and arms them to merge on green.
- **Dependabot PRs have no cap.** All open ones go into one consolidation PR per run.
- **Other stuck PRs:** at most 3 per run.
- Dependabot (23:37 Paris) and the audit (`audit-fix.yml`, 23:07 UTC) run ahead of the sweep (01:42 Paris), so
  whatever they open is handled the same night.

## Arming: the `automerge` label

Sweep sessions can't call GitHub's GraphQL API, which is the only way to enable auto-merge. Instead, add the
`automerge` label:

```bash
gh api repos/Seven74AI/the-swarm/issues/<n>/labels -f 'labels[]=automerge'
```

`.github/workflows/auto-merge.yml` (job `label-auto-merge`) then arms squash auto-merge with `AUTOMERGE_TOKEN`, and
GitHub merges once the required checks are green. **Never** merge through `PUT /pulls/<n>/merge`: the sweep's
credentials can bypass branch protection, so that would skip CI.

If the label is already there but the PR isn't armed (for example after it was closed and reopened), remove it
and add it again.

## Which PRs to look at

List open PRs: `gh api 'repos/Seven74AI/the-swarm/pulls?state=open&per_page=100'`. Skip a PR when any of these
holds:

- it is a draft, or its head branch is on a fork;
- it has one of the labels `ready-for-human`, `needs-info`, `wontfix`. Those are the owner's hold: don't touch it;
- its CI is still running: a check run on its head commit is `queued` or `in_progress`
  (`gh api repos/Seven74AI/the-swarm/commits/<head sha>/check-runs`). Age doesn't matter: a PR opened minutes ago
  whose checks have finished is fair game;
- it is armed (`auto_merge` set), green and mergeable. It will merge by itself;
- an earlier sweep comment says it gave up, and neither its head nor `main` has moved since.

What's left splits into **Part A** (PRs opened by `dependabot[bot]`, plus the daily audit's leftovers) and
**Part B** (everything else).

## Part A: Dependabot consolidation (no cap)

Land every Dependabot update in **one** PR instead of fixing them one by one.

1. **Collect.**
   - Every Part A Dependabot PR. Read its bumps from the head commit message: the `updated-dependencies:` block
     gives `dependency-name`, `dependency-version` and `dependency-type`.
   - The latest "Dependency audit" run
     (`gh api 'repos/Seven74AI/the-swarm/actions/workflows/audit-fix.yml/runs?per_page=1'`). If it failed because
     advisories remain, add those packages too. They need a range bump in `package.json` (as in #213: a dev tool
     lagging its peer, or a major).
   - If there is nothing to collect, skip Part A.
2. **Branch.**
   - If an open PR from a `claude/deps-consolidation-*` branch exists, reuse it: merge `origin/main` into it, never
     rebase.
   - Otherwise create `claude/deps-consolidation-YYYYMMDD` from the latest `main`.
3. **Apply each update as its own commit**, so a bad one can be reverted alone. Name the commit
   `chore(deps): <Dependabot PR title> (#<n>)`.
   - **npm**, `direct:development`: `pnpm add -D <name>@<version>`.
   - **npm**, `direct:production`: `pnpm add <name>@<version>`.
   - **npm**, indirect: `pnpm update <name>`, then check that `pnpm why <name>` shows at least that version.
   - Don't copy Dependabot's lockfile; regenerate it with pnpm.
   - **github-actions:** apply the PR's workflow diff
     (`git diff origin/main...origin/<dependabot-branch> -- .github/workflows | git apply`). Only the `uses:` refs may
     change. If the push of a workflow change is refused for lack of permission, revert that commit and hand the PR
     to the owner (see *When you can't land it*).
4. **Majors.** Read the release notes, changelog and migration guide for every major (Context7 or the web). Search
   the code for the APIs that changed, adapt the code and tests in a separate commit, and keep TDD for any
   behaviour change.
5. **Verify** with `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and
   the **full** Playwright suite.
   - If one update can't be made green after 2 fix attempts, `git revert` its commit (never rewrite history),
     comment on its Dependabot PR with what failed, add `ready-for-human`, and carry on with the rest. One bad bump
     must not block the others.
6. **Open the PR.**
   - Title: `chore(deps): consolidate Dependabot updates (<N> PRs)`.
   - Body: one line per update (`#<n> <package> <from> → <to>`), what you changed for each major, and what was left
     out and why.
   - Push, open the PR, and add the `automerge` label.
   - Comment on each included Dependabot PR: `Included in #<consolidation PR>.` Don't close them yourself.
     Dependabot closes a PR on its next run once `main` has that version or newer. Closing it by hand would tell
     Dependabot to ignore that version if the consolidation then fails.
7. **Watch CI** on the consolidation PR. If it goes red, fix the cause (2 attempts), as for a red Part B PR.

## Part B: other stuck PRs (at most 3 per run)

Oldest first. This limit is separate from the 3-issue limit.

1. **Merge conflict** (`mergeable_state: dirty`): merge `origin/main` into the branch. Never rebase, amend or
   force-push. If `pnpm-lock.yaml` conflicts, take `main`'s copy and run `pnpm install` to regenerate it.
2. **Red CI.**
   - Read the failed job logs: `gh api repos/Seven74AI/the-swarm/actions/runs/<id>/jobs`, then the job's logs.
   - Reproduce locally, fix the root cause on the PR's branch, and run the failing check locally to show it passes.
   - A job gets at most one re-run, and only for an infrastructure failure (runner, network, registry), never for a
     test.
   - The usual rules hold: never weaken, skip or quarantine a test, never add `|| true` or `--if-present`, never
     touch `ci.yml` or branch protection to get green.
3. **Green and mergeable but not armed:** add the `automerge` label.

## When you can't land it

After 2 fix attempts on the same PR, or when the fix needs a design or balance decision: leave the PR open, comment
with what fails, what you tried and what is needed, and add the `ready-for-human` label. The next runs skip it
until the owner removes that label.

## Report

In the run summary:
- the consolidation PR (link, the updates it includes, what you changed for majors, and anything left out);
- each Part B PR you touched (link, what was wrong, what you did);
- for each, whether it is armed, merged, or handed to the owner.
