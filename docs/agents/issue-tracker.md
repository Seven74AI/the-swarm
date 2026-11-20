# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on `Seven74AI/the-swarm`.

Use the REST API through `gh api`. Commands like `gh issue list` / `gh pr create` go through GraphQL, which is
not available in every agent environment (Claude Code cloud sessions block it); `gh api` works everywhere `gh` is authenticated.

## Conventions

- **Create an issue**: pipe JSON so multi-line bodies survive:
  `jq -n --arg t "..." --arg b "$BODY" '{title:$t, body:$b, labels:["needs-triage"]}' | gh api repos/Seven74AI/the-swarm/issues --input -`
- **Read an issue**: `gh api repos/Seven74AI/the-swarm/issues/<n> --jq '{title, body, labels: [.labels[].name]}'`
  and its comments: `gh api repos/Seven74AI/the-swarm/issues/<n>/comments --jq '.[].body'`
- **List issues**: `gh api 'repos/Seven74AI/the-swarm/issues?state=open&per_page=100' --jq '.[] | select(.pull_request | not) | {number, title, labels: [.labels[].name]}'`
  Filter by label with `&labels=ready-for-agent`. (The endpoint also returns PRs — the `select` drops them.)
- **Comment**: `gh api repos/Seven74AI/the-swarm/issues/<n>/comments -f body="..."`
- **Add a label**: `gh api repos/Seven74AI/the-swarm/issues/<n>/labels -f 'labels[]=ready-for-agent'`
- **Remove a label**: `gh api -X DELETE repos/Seven74AI/the-swarm/issues/<n>/labels/needs-triage`
- **Close**: comment first, then `gh api -X PATCH repos/Seven74AI/the-swarm/issues/<n> -f state=closed -f state_reason=completed`
- **Open a PR**: `gh api repos/Seven74AI/the-swarm/pulls -f title="..." -f head=<branch> -f base=main -f body="..."`.
  Reference the issue with `Closes #<n>` in the body.

The repo has 100+ `kanban:t_*` labels: when listing labels, paginate (`?per_page=100&page=2`).

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read the issue and its comments as above.
