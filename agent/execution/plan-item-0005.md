# Plan: Finish And Cancel The Workout Flow

## Item Reference

- `agent/execution/open-item-0005.md`

## Goal Summary

Define the implementation steps needed to keep workout cancellation available during exercise progression and to add a distinct `Finish Workout` action on the last exercise with the same confirmation safeguards used for forward navigation.

## Implementation Approach

- Inspect the active workout exercise flow to identify where cancel actions, next-exercise navigation, and set completion controls are currently rendered and handled.
- Keep the persisted-workout cancellation entry point available from the exercise flow without changing the existing cancellation path semantics.
- Add a dedicated `Finish Workout` action on the last exercise only, keeping it separate from set completion so unfinished editable rows are not implicitly persisted.
- Reuse the existing non-blocking confirmation decision logic for forward navigation, extending it so workout completion prompts when no set has been completed on the current exercise or when the editable row differs from suggested values.
- Ensure the finish action only persists already completed sets and does not convert an edited in-progress row into a completed set unless the user explicitly performs the set completion action first.

## Risks and Assumptions

- The current forward-navigation confirmation logic is reusable or can be extracted without changing the item scope.
- Last-exercise handling may currently be coupled to next-exercise navigation, so separating the finish action could require small UI and state-flow adjustments.
- Tests may need updates if current active workout coverage assumes the last exercise advances through the same control path as intermediate exercises.

## Validation Plan

- Run targeted active workout tests covering cancellation availability, last-exercise controls, and finish confirmation behavior.
- Run `cargo test active_workout` to satisfy the item acceptance criteria.

## Out of Scope

- Changing workout completion rules outside the last-exercise flow.
- Redesigning the cancellation UX beyond keeping the existing cancellation path available.
- Expanding persistence behavior to save unfinished rows automatically.

## Handoff Notes for Implementation

- Preserve the rule that only completed sets are persisted.
- Keep the plan implementation-oriented; do not alter item scope or acceptance criteria while making the UI and flow changes.
