# Plan: Workout Persistence Vertical Slice

## Plan ID

pb-006

## Goal

Implement a minimal end-to-end workout flow that starts in the renderer, uses the backend API, and persists completed workout data into PostgreSQL when the user finishes the workout.

## Scope

- Add a minimal renderer-driven workout submission flow that persists a completed workout through the backend into the database.
- Reuse the existing renderer workout wizard as the basis for the flow instead of introducing a new parallel UI.
- If the implementation remains small, allow the user to choose among seeded training plans and seeded gyms before starting the workout.
- Keep workout capture intentionally narrow: one recorded set per exercise, using the existing UI weight entry and fixed dummy reps.
- Add or extend backend API endpoints needed to create the workout and persist `workouts`, `workout_exercises`, and `workout_sets`.
- Keep the backend write path aligned with the future direction in which individual sets will be synced incrementally during workout execution.
- Use `NULL` where schema allows it and otherwise use explicit dummy seed records or dummy references for fields not yet modeled in the renderer flow.
- Document temporary dummy-value usage in backend code with clear comments that indicate where future real selections or real data must replace them.
- Add or update tests that verify the end-to-end persistence path for the scoped workout flow.

## Out of Scope

- full workout domain coverage across all modeled entities and choices
- per-set incremental sync during workout execution
- resume/recovery of partially synced workouts
- reps entry in the renderer beyond fixed dummy values
- multi-set capture in the renderer
- workout history, analytics, or detailed post-workout summary views
- replacing temporary dummy references with fully user-driven domain selections where that would expand scope materially
- broader domain cleanup or schema redesign unrelated to the vertical slice

## Success Criteria

- A user can start from the renderer workout flow and complete a workout that results in persisted rows in `workouts`, `workout_exercises`, and `workout_sets`.
- The completed workout is created through the backend API rather than direct renderer-only state.
- The renderer shows a simple success state after the workout is saved.
- If plan and gym selection are included, the renderer offers seeded choices sourced through the backend without requiring hardcoded renderer-only combinations.
- Each persisted exercise contains exactly one persisted set for this plan slice, with weight sourced from the UI and fixed dummy reps.
- Required schema fields outside the scoped UX are satisfied via `NULL` or explicit dummy references without hiding that they are temporary.
- Backend code clearly marks temporary dummy-value paths so they can be replaced by real user-driven data in later plans.
- Automated tests cover the scoped write path and protect the intended vertical slice behaviour.

## Constraints

- Preserve the existing technology and architecture baseline: Web Components/TypeScript renderer, Rust/Axum/SQLx backend, PostgreSQL persistence.
- Keep the plan small enough to refine into roughly 4-8 execution items.
- Favor reuse of existing seed data, repository code, and current workout wizard behaviour over introducing broad new abstractions.
- The main persistence moment for this plan is workout completion, but the API and backend design should not block a later move to incremental set-by-set synchronization.
- Prefer an additive change set that exposes the backend write path cleanly instead of overfitting to temporary dummy data.
- User-facing scope should remain minimal and pragmatic; a simple success confirmation is sufficient after saving.

## Inputs

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
