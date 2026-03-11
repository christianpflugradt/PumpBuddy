# Plan: Document Workout Execution and Recovery

## Item Reference

- `agent/execution/open-item-0001.md`

## Goal Summary

Document the current workout lifecycle in the design artifacts, including first-write persistence, incremental progress updates, automatic resume, cancellation, the single-active-workout assumption, and English-only user-facing copy.

## Implementation Approach

- Update `agent/design/use-cases.md` to describe the workout flow from start through completion, including the pre-persistence exit path and cancellation behavior.
- Update `agent/design/domain-model.md` to define `ActiveWorkout` for this slice and record that the system assumes at most one active workout at a time.
- Keep the changes documentation-only and aligned with plan `pb-007` without expanding the current one-weight-per-exercise scope.

## Risks and Assumptions

- The plan assumes the existing `pb-007` strategy remains the authoritative source for workflow boundaries and terminology.
- The item should not introduce implementation detail beyond what is needed to make the design docs actionable for later agents.

## Validation Plan

- Review both updated design documents for explicit coverage of start, first persisted confirmation, incremental updates, resume after reload, completion, cancellation, and pre-persistence exit behavior.
- Run `git diff -- agent/design/use-cases.md agent/design/domain-model.md` and confirm the diff contains only documentation changes aligned with `pb-007`.

## Out of Scope

- Any executable source code, schema, API, or test changes.
- Expanding the documented flow beyond the current single active workout and one-weight-per-exercise slice.

## Handoff Notes for Implementation

- Preserve English for user-facing copy references in this flow.
- Keep the wording implementation-oriented, but do not change the item’s acceptance criteria or broaden the feature scope.
