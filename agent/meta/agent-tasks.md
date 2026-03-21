# Agent Tasks

## Purpose

This document defines **what tasks exist** and the intended task boundaries.
It is the human-readable task catalog for framework maintenance.

Operational runtime behavior remains script-driven via:

- `agent/scripts/tasks.sh`
- `agent/execution/task-context/*.yaml`
- `agent/execution/task-spec/*.yaml`

## Task Set

Core tasks:

1. `discuss-plan`
2. `refine-plan`
3. `plan-item`
4. `implement-item`
5. `review-item`
6. `finalize-plan`

Extended review tasks:

7. `review-architecture`
8. `review-consistency`
9. `review-quality`
10. `review-security`
11. `review-technology`

## Alias Mapping

Defined in `agent/scripts/tasks.sh`:

- `discuss-plan`: `discuss`, `go`, `1`
- `refine-plan`: `refine`, `split`, `2`
- `plan-item`: `plan`, `3`
- `implement-item`: `implement`, `do`, `4`
- `review-item`: `review`, `see`, `5`
- `finalize-plan`: `finalize`, `end`, `6`
- `review-architecture`: `review-arch`, `arch-review`, `7`
- `review-consistency`: `review-consistency`, `consistency-review`, `8`
- `review-quality`: `review-quality`, `quality-review`, `9`
- `review-security`: `review-security`, `security-review`, `10`
- `review-technology`: `review-technology`, `technology-review`, `tech-review`, `11`

## Task Intent and Boundaries

### `discuss-plan`

Intent:
- align plan goal/scope with stakeholder
- keep discussion iterative and bounded

Boundaries:
- does not create execution items
- does not jump ahead into implementation

### `refine-plan`

Intent:
- split active plan into executable backlog items

Boundaries:
- does not implement code
- does not redefine plan goals implicitly

### `plan-item`

Intent:
- prepare implementation plan for selected open item

Boundaries:
- does not change item scope/acceptance criteria
- does not implement code

### `implement-item`

Intent:
- implement selected open item and prepare review transition

Boundaries:
- item remains source of truth for scope
- no implicit framework/strategy rewrites

### `review-item`

Intent:
- decide accept (`review -> done`) or return (`review -> open`) with findings

Boundaries:
- no silent scope expansion
- findings must be actionable

### `finalize-plan`

Intent:
- run stakeholder acceptance gate at plan level
- either archive accepted cycle or generate return items

Boundaries:
- requires explicit stakeholder decision
- no finalize while open/review items exist

### Extended Reviews (`review-*`)

Shared intent:
- evaluate one focused quality dimension in active plan context
- produce structured findings
- let stakeholder select which findings become backlog items

Dimension boundaries:
- `review-architecture`: boundaries/layering/dependency direction
- `review-consistency`: cross-artifact alignment drift
- `review-quality`: reliability/testability/maintainability confidence
- `review-security`: trust boundaries/access/secrets/exposure
- `review-technology`: stack/tooling/dependency adherence

## Design Rules for New Tasks

- clear bounded purpose
- explicit completion condition
- explicit boundaries
- deterministic script-driven behavior
- minimal overlap with existing tasks

## Change Notes

- 2026-03-21: Reduced to task catalog focus (what), aligned with current YAML/script runtime model.
