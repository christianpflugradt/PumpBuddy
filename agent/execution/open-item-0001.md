# Document Workout Execution and Recovery

## Goal

Document the workout execution, incremental persistence, automatic resume, cancellation, and English-only copy rules for the current product slice.

## Scope

- update the relevant design documents to describe the active workout lifecycle from first confirmation through completion
- record the pre-persistence exit behavior and the single-active-workout assumption
- ensure the documentation states that user-facing product copy for this flow remains in English

## Acceptance Criteria

- `agent/design/use-cases.md` describes start, first persisted confirmation, incremental updates, automatic resume after reload, completion, cancellation, and pre-persistence exit behavior
- `agent/design/domain-model.md` reflects the `ActiveWorkout` concept and the single-active-workout assumption for this slice
- the documentation explicitly states that user-facing copy remains in English for this flow
- `git diff -- agent/design/use-cases.md agent/design/domain-model.md` shows only documentation changes aligned with plan `pb-007`

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`

## Out of Scope

- changing executable source code
- expanding the documented flow beyond the current one-weight-per-exercise slice








## Review Findings

### Criterion

[`git diff -- agent/design/use-cases.md agent/design/domain-model.md` shows only documentation changes aligned with plan `pb-007`]

- Status: fail
- Evidence: `git diff -- agent/design/use-cases.md agent/design/domain-model.md` returned no output, `git diff --stat -- agent/design/use-cases.md agent/design/domain-model.md` returned no output, `git status --short` returned no output, and `git diff --check -- agent/design/use-cases.md agent/design/domain-model.md` returned no output. The worktree is clean, so there is no reviewable documentation-only change set for this item.
- Risk: Acceptance would not verify that the `pb-007` documentation update was delivered as a scoped change for this execution item, so the item cannot be validated against its own acceptance criteria.

### Additional Notes

- `agent/design/use-cases.md` and `agent/design/domain-model.md` currently contain the expected workout execution, incremental persistence, automatic resume, cancellation, single-active-workout, and English-only documentation content.
