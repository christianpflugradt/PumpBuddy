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
- the implementation commit for this item changes only `agent/design/use-cases.md` and `agent/design/domain-model.md` in alignment with plan `pb-007`

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`

## Out of Scope

- changing executable source code
- expanding the documented flow beyond the current one-weight-per-exercise slice


## Review Acceptance

- Criteria Met: `agent/design/use-cases.md` documents start, first persisted confirmation, incremental updates, automatic resume after reload, completion, cancellation, and pre-persistence exit behavior; `agent/design/domain-model.md` defines `ActiveWorkout`, the single-active-workout assumption, and English-only workout-flow copy; commit `d87c4fb` changed only those two design documents plus the execution item state rename into review, matching `pb-007`.
- Evidence: `agent/design/use-cases.md` includes the main flow, cancellation flow, and pre-persistence exit flow for the workout lifecycle, with explicit English-only copy constraints and startup recovery wording. `agent/design/domain-model.md` defines `ActiveWorkout` as an unfinished persisted `Workout`, states the single-active-workout assumption, and documents that workout execution copy remains in English.
- Runtime/Build Check: `git diff --check d87c4fb^ d87c4fb` exited successfully with no output, indicating the accepted commit has no patch-formatting issues.
- Residual Risk: none identified
