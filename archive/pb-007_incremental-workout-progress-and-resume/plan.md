# Plan: Incremental Workout Progress and Resume

## Plan ID

pb-007

## Goal

Extend the existing workout flow so an in-progress workout is persisted incrementally, automatically restored on reload, and can be explicitly cancelled, while documenting the workout execution use case and keeping the product UI fully in English.

## Scope

- Document the workout execution and recovery use case in the design artifacts so later implementation and review agents have a precise behavioural reference.
- Persist an active workout only after the first confirmed exercise weight is submitted to the backend.
- Update the persisted workout state after each exercise weight confirmation without changing the current step-by-step workout flow.
- Automatically route the user back into the active workout when the application reloads and at least one active workout exists.
- Enforce the product assumption that only one active workout should exist at a time; handling invalid multiple-active-workout states is out of scope beyond selecting the first active workout if needed.
- Add a workout cancellation action with an English confirmation prompt that deletes all persisted data for an unfinished workout.
- Record in strategy or design documents that user-facing product copy should remain in English.

## Out of Scope

- redesigning the workout flow beyond the existing per-exercise weight entry interaction
- adding manual resume controls on the start screen
- changing the completion flow for finished workouts
- handling multiple active workouts as a dedicated recovery or repair scenario
- expanding workout capture beyond the current one-weight-per-exercise slice

## Success Criteria

- The design documents describe the workout use case, including start, incremental persistence, automatic resume after reload, completion, and cancellation.
- A workout is not persisted before the first exercise weight is confirmed, and no cancellation cleanup is needed if the user exits before that first persisted change.
- After each confirmed exercise weight, the backend stores enough state to restore the unfinished workout.
- Reloading the application during an unfinished persisted workout routes the user directly into that workout instead of the new-workout start screen.
- The start screen does not offer a separate "resume workout" action for this plan slice.
- An unfinished persisted workout can be cancelled through an English confirmation flow, and cancellation removes all stored traces of that workout.
- Finished workouts cannot be cancelled through the workout UI.

## Constraints

- Preserve the existing workout interaction shape: one weight entry per exercise and progression through the current workflow.
- Keep implementation aligned with the current stack and the existing workout persistence slice from `pb-006`.
- Treat user-facing product text as English-only for this project stage.
- Keep the plan small enough to refine into roughly 4-8 execution items.

## Inputs

- `archive/pb-006_workout-persistence-vertical-slice/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `renderer/src/app.ts`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/src/domain.rs`
- `backend/init.sql`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
