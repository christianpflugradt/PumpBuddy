# Plan: Document Workout Execution and Recovery

## Item Reference

- `agent/execution/open-item-0001.md`

## Goal Summary

Document the current workout execution lifecycle in the design artifacts, including incremental persistence, automatic resume, cancellation, pre-persistence exit behavior, the single-active-workout assumption, and English-only user-facing copy.

## Implementation Approach

- Update `agent/design/use-cases.md` to describe the workout flow from start through completion, plus cancellation and pre-persistence exit behavior.
- Update `agent/design/domain-model.md` to define `ActiveWorkout` semantics and the current single-active-workout assumption for this slice.
- Keep the changes documentation-only and aligned with plan `pb-007` without expanding scope beyond the current one-weight-per-exercise workflow.

## Risks and Assumptions

- The existing design documents may already contain nearby wording, so edits should consolidate rather than duplicate behaviour statements.
- The plan assumes no executable source files or broader product flows need to change for this item.

## Validation Plan

- Review both updated design documents to confirm they cover each acceptance-criteria scenario and preserve the English-only copy rule.
- Run `git diff -- agent/design/use-cases.md agent/design/domain-model.md` and confirm the diff contains only the intended documentation changes.

## Out of Scope

- Any executable code, tests, or schema changes.
- Any workflow expansion beyond the current one-weight-per-exercise workout slice.

## Handoff Notes for Implementation

- Keep wording concrete enough to guide later implementation and review tasks.
- Do not change item scope or acceptance criteria while refining the documentation language.
