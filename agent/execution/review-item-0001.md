# Item 0001: Render Set-Oriented Exercise Rows

## Goal

Redesign the workout exercise screen so completed sets and the current editable set use one compact set-oriented row layout with load and reps controls side by side on the editable row.

## Scope

- update the workout exercise screen to render completed sets and the editable set in a consistent horizontal row structure
- keep the lowest row as the current editable unconfirmed set
- show increment and decrement controls for load and reps only on the editable row
- preserve English user-facing copy while updating labels or button text needed by the new layout

## Acceptance Criteria

- the current exercise screen shows completed sets as read-only rows and the current draft set as the bottom editable row using the same visual structure
- load and reps controls are displayed side by side within the editable row, each with decrement and increment controls
- completed rows do not expose editing affordances
- `npm --prefix frontend test -- --run` passes

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/test-strategy.md`

## Out of Scope

- changing set completion persistence behaviour
- changing exercise navigation rules

## Notes for Review

- verify the visual distinction comes from read-only versus editable affordances rather than a separate layout pattern


## Review Findings

### Criterion

`npm --prefix frontend test -- --run` passes

- Status: fail
- Evidence: The committed implementation is in `renderer/`, and `npm --prefix renderer test -- --run` passes with `13` passing tests. The acceptance-criterion command itself fails in this repository with `ENOENT` because `/Users/cpf/Workspace/personal/PumpBuddy/frontend/package.json` does not exist.
- Risk: The item cannot be accepted against its own explicit verification criterion. Leaving the mismatch in place makes review outcomes ambiguous and weakens the deterministic validation path for this repository.
