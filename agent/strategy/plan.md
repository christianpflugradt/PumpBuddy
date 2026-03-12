# Plan: Set-Based Workout Flow Correction

## Plan ID

pb-010

## Goal

Make the set-based workout flow behave correctly and redesign the workout exercise screen around a compact set-oriented table/list layout that clearly separates set completion from exercise navigation.

## Scope

- show completed sets and the current editable set in a consistent horizontal, table-like layout
- keep the lowest row as the current unconfirmed set
- place load and reps controls side by side in that editable row, each with decrement and increment controls
- replace the faulty `Next Set` behaviour with an explicit set completion action that only completes the current set on the current exercise
- persist each completed set immediately when the user finishes that set
- create a fresh next editable set row after a set is completed
- keep `Next Exercise` as a navigation action that never persists an unfinished editable row
- allow forward navigation only after at least one completed set exists for the current exercise
- show a confirmation dialog before forward navigation when no set has been completed yet or when the current editable row has been changed away from its suggested values
- allow backward navigation up to the first exercise
- keep previously left exercises visible in read-only form when revisited
- preserve the current exercise state so that returning to it restores completed sets plus the still-editable unconfirmed row
- include workout-level actions for cancellation and workout completion, with completion available on the last exercise
- apply the same non-blocking confirmation pattern to `Finish Workout` on the last exercise when no set has been completed yet or when the editable row has been modified
- fix the current workflow bug where the set action advances through exercises instead of adding sets on the active exercise

## Out of Scope

- editing already completed sets
- re-enabling editing on earlier exercises after moving forward
- workout history, analytics, or reporting views
- advanced training constructs such as supersets, rest timers, or custom set types
- spreadsheet-style visual chrome; the requirement is a row-oriented layout, not a literal grid with table borders

## Success Criteria

- completing a set adds a completed set on the current exercise and does not navigate to another exercise
- each completed set is persisted immediately after confirmation
- unfinished edits in the current editable row are never implicitly persisted by exercise navigation or workout completion
- forward navigation proceeds without confirmation only when at least one set is already completed and the editable row still matches its suggested values
- the user can navigate back exercise-by-exercise to the first exercise and only view those prior exercises in read-only mode
- returning to the current in-progress exercise restores the completed rows and the still-editable open row
- the read-only and editable set rows use a clearly related visual structure, with editing affordances visible only on the open row
- workout cancellation remains available from the exercise flow
- workout completion on the final exercise follows the same confirmation rules as forward navigation

## Constraints

- user-facing product copy remains in English
- only completed sets are persisted; draft edits in the open row remain local until confirmed
- set completion, exercise navigation, cancellation, and workout completion must remain distinct user actions with distinct effects
- refinement should prefer smaller execution items over broader ones for this plan so the workflow change can be implemented and verified incrementally
- review must verify requirement-level behaviour carefully, with explicit attention to the regression where the set action incorrectly advances exercises instead of adding a set

## Inputs

- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
For this plan, refinement should bias toward a slightly larger number of smaller execution items so UI flow, persistence rules, navigation rules, and validation behaviour can be reviewed in isolation.
