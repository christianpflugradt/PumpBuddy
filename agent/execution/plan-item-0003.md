# Plan: Gate Exercise Navigation With Draft Confirmation

## Item Reference

- `agent/execution/open-item-0003.md`

## Goal Summary

Adjust the exercise navigation flow so `Next Exercise` only changes exercise position, never persists the current draft row on its own, and asks for confirmation before forward navigation when the current exercise has no completed work yet or the draft differs from its suggested values.

## Implementation Approach

- separate set completion from exercise navigation in `renderer/src/app.ts` so `next-set` remains the only action that converts the editable draft into a completed persisted set
- add explicit navigation guards and helper predicates for forward and backward movement, including detection of whether the current exercise has any completed sets and whether the editable draft still matches the current suggested values
- update the exercise-step UI to expose backward navigation up to the first exercise, disable or hide it on the first exercise, and route `Next Exercise` through a confirmation step without writing draft state to the backend
- keep active workout persistence payloads limited to completed sets, but make sure navigation after confirmation advances the local view and preserves the unpersisted draft row for the next save-triggering action
- extend `renderer/src/app.test.ts` to cover forward navigation without confirmation when completed work exists and the draft is unchanged, confirmation when no set exists or the draft is modified, no draft persistence from `Next Exercise`, and backward-navigation availability rules

## Risks and Assumptions

- the current `persistActiveSet("exercise")` path couples forward navigation with persistence and completion semantics, so the implementation will likely need a dedicated navigation path rather than a small conditional tweak
- the suggested draft baseline is assumed to be the current `activeSet` seeded from `applyActiveWorkoutResponse` or the default fallback values; if the UI derives suggestions elsewhere, the comparison helper must follow that source instead
- because the current renderer only shows the active exercise, backward navigation is assumed to restore the local in-memory state for previously visited exercises without adding new resume semantics beyond the item scope

## Validation Plan

- run `npm --prefix frontend test -- --run`
- confirm the new navigation tests assert that `Next Exercise` does not add to `completed_sets` payloads or call persistence APIs when it only changes view state
- manually verify via renderer tests that backward navigation is unavailable on exercise 1 and available on later exercises

## Out of Scope

- restoring previously visited exercise state from backend persistence beyond the existing local workout-plan state
- changing finish-workout confirmation behavior or redefining set completion rules

## Handoff Notes for Implementation

- keep the plan scoped to renderer behavior unless a backend contract mismatch blocks the change
- prefer small pure helpers for draft-dirty and can-navigate checks so the confirmation rules are easy to test without DOM-heavy setup
