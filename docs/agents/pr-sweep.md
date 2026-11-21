# Stuck-PR pass (nightly sweep)

The nightly Claude sweep runs this pass **before** the `ready-for-agent` issue queue. Its job is to land open PRs
that auto-merge couldn't: red CI, merge conflicts, Dependabot majors, and vulnerabilities the daily audit couldn't
fix on its own. CI stays the only gate. The sweep never merges a PR itself; it fixes the PR, then lets GitHub merge
it once the required checks (`typecheck`, `vitest`, `playwright-gate`) pass.

Owner decisions (2026-11-21): the sweep fixes stuck PRs and Dependabot **majors** too, and arms them to merge on
green. Dependabot (23:37 Paris) and the audit (`audit-fix.yml`, 23:07 UTC) run ahead of the sweep (01:42 Paris), so
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

## Candidates

List open PRs: `gh api 'repos/Seven74AI/the-swarm/pulls?state=open&per_page=100'`. A PR is a candidate when all of
these hold:

- it is not a draft, and its head branch lives in this repo (no forks);
- it has none of the labels `ready-for-human`, `needs-info`, `wontfix`. Those are the owner's hold: don't touch it;
- it was last updated more than 1 hour ago, so its CI isn't still running;
- it isn't already armed (`auto_merge` is null) **or** it is armed but red, conflicted, or out of date with `main`;
- no earlier sweep comment says it gave up, unless the head or `main` has moved since that comment.

Handle **at most 3 PRs per run**, oldest first. They count separately from the 3-issue limit.

## For each PR, in this order

1. **Merge conflict** (`mergeable_state: dirty`).
   - Dependabot PR that you haven't pushed to: comment `@dependabot rebase` and move on. Dependabot redoes it.
   - Any other PR: merge `origin/main` into the branch. Never rebase, amend or force-push. If `pnpm-lock.yaml`
     conflicts, take `main`'s copy and run `pnpm install` to regenerate it.
2. **Red CI.** Read the failed job logs (`gh api repos/Seven74AI/the-swarm/actions/runs/<id>/jobs`, then the job's
   logs). Reproduce locally, fix the root cause on the PR's branch, and run the failing check locally to show it
   passes. A job gets at most one re-run, and only for an infrastructure failure (runner, network, registry), never
   for a test. The usual rules hold: never weaken, skip or quarantine a test, never add `|| true` or
   `--if-present`, never touch `ci.yml` or branch protection to get green.
   - Pushing to a Dependabot branch is fine. Dependabot then stops updating that PR, so from then on you own it:
     resolve its conflicts by merging `main`, as for any other PR.
3. **Dependabot major** (`update-type: version-update:semver-major` in the head commit message, or a major jump in the title).
   Read the release notes, changelog and migration guide for every bumped package (Context7 or the web). Search the
   code for the APIs that changed, adapt the code and tests, and keep TDD for any behaviour change. Then run
   `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and the **full** Playwright suite. In a PR comment, list
   the breaking changes you checked and what you changed. Then arm the PR with the label.
4. **Daily audit left advisories.** Check the latest run of the "Dependency audit" workflow
   (`gh api 'repos/Seven74AI/the-swarm/actions/workflows/audit-fix.yml/runs?per_page=1'`). If it failed because
   advisories remain, and no open PR or issue already covers them, raise the range in `package.json` yourself (as in
   #213: a dev tool lagging its peer, or a major bump), run the full check list from step 3, and open a PR on
   `claude/deps-<package>`. This counts toward the 3-PR limit.
5. **Green, mergeable, not armed.** Add the `automerge` label.

## When you can't land it

After 2 fix attempts on the same PR, or when the fix needs a design or balance decision: leave the PR open, comment
with what fails, what you tried and what is needed, and add the `ready-for-human` label. The next runs skip it
until the owner removes that label.

## Report

In the run summary, list each PR you touched: the link, what was wrong, what you did, and whether it is now armed,
merged, or handed to the owner.
