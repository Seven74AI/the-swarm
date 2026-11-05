# AGENTS.md

## Workflow (canonical: Seven74AI/agent-workflow)

- Non-negotiable: secrets never in context; never ship without a risk gate; read
  `docs/decisions/` before proposing a new primitive or surface.
- Track work: GitHub Issues + the "Development" board. `ready-for-agent` =
  implement unattended; `needs-info` / `ready-for-human` / `wontfix` = stop.
- ADRs: `docs/decisions/` — steering veto list.
- Process detail: `Seven74AI/agent-workflow` (`docs/domains/`, `docs/decisions/`).

## Repo gotchas

- Single-context repo: `CONTEXT.md` + `docs/decisions/` at the repo root.
- Issue tracker: `Seven74AI/the-swarm` (use `gh` CLI).
- Triage labels: `needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`.
- Domain docs: `docs/agents/domain.md`.
