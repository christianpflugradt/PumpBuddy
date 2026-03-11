# Plan: Document Workout Execution and Recovery

## Item Reference

- `agent/execution/open-item-0001.md`

## Goal Summary

Document the active workout lifecycle and recovery rules in the design docs without changing executable code or broadening the current product slice.

## Implementation Approach

- Update `agent/design/use-cases.md` to describe workout start, first persisted confirmation, incremental persistence after each confirmed weight, automatic resume after reload, completion, cancellation, and the pre-persistence exit behavior.
- Update `agent/design/domain-model.md` to define the `ActiveWorkout` concept for this slice and record the single-active-workout assumption.
- State in the relevant flow documentation that user-facing copy for this workout slice remains in English.

## Risks and Assumptions

- The existing design docs may already describe parts of the flow, so edits should refine and consolidate wording rather than create conflicting duplicate sections.
- The plan assumes `pb-007` remains the governing behavioral reference and that this item is documentation-only.

## Validation Plan

- Review the updated sections in `agent/design/use-cases.md` and `agent/design/domain-model.md` against the item acceptance criteria.
- Inspect the implementation commit for this item and confirm it changes only `agent/design/use-cases.md` and `agent/design/domain-model.md` in a way that matches `pb-007`.

## Out of Scope

- Any executable source code, schema, or API changes.
- Expanding the documented behavior beyond the current one-weight-per-exercise workout slice.

## Handoff Notes for Implementation

- Keep the plan lightweight and avoid redefining acceptance criteria in the implementation output.
- Preserve terminology across both design documents so the execution and domain descriptions stay aligned.
