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
