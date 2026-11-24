# 0051: Room jobs are counts by job, with a pool of fresh rooms

Status: accepted (Story 9.14, 2026-11-24)

## Context

Story 9.14 lets a room take a job (Gallery first; Larder and Pantry follow in Stories 9.15 and 9.16). Rooms have no identity in the state: `dig.roomsDug` is a count, and no ant has a location (ADR 0047, the scene draws from counts).

## Decision

- `state.roomJobs.jobs` counts rooms by job; the plain rooms are `dig.roomsDug` minus their total, never negative. A job is a key of `roomJobBalance.jobs` (effects) with its copy in `data/content/roomJobs.ts`, so a new job is data plus a migration default, never a UI change.
- `state.roomJobs.fresh` counts the plain rooms never assigned: every room opens fresh, and a fresh room's first job is free. Any other change costs `roomJobBalance.changeCostStone`. Fresh rooms are fungible, like the rooms themselves.
- One change is one room: `actions.setRoomJob(from, to)` with `from`/`to` a job or `plain`. Effects apply at the change (a Gallery adds `digBalance.roomSize` to `resources.nestCapacity`), so every reader of capacity sees them without knowing about jobs.
- The choice when a DIG press opens a room is a peek (ADR 0011), raised by main on `room_opened` with `byPress`; rooms opened by diggers, auto-dig or catch-up open plain and fresh.

## Consequences

- Capacity is stored, not derived: a migration that changes `roomSize` would not resize old rooms. Saves keep the capacity they had (no capacity is lost on load), as v35 did.
- A per-room identity (named rooms, the nest close-up of batch 3) would need a new shape; the counts migrate to it as "n rooms of each job".
