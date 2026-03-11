# Extend Workout Slice API Contract

## Goal

Define the canonical OpenAPI contract for the workout persistence slice so the renderer and backend can implement the same seeded selection and workout completion flow.

## Scope

- update `agent/design/api-contract.yaml` with the endpoints and schemas needed for this slice
- add a seeded gym listing endpoint to support renderer-side start selections
- add a workout completion creation endpoint with request and response payloads that cover one recorded set per exercise
- keep the contract aligned with the current minimal vertical slice and avoid premature incremental-sync commands

## Acceptance Criteria

- `agent/design/api-contract.yaml` defines a `GET /api/gyms` endpoint that returns seeded gym summaries
- `agent/design/api-contract.yaml` defines a `POST /api/workouts` endpoint that accepts a completed workout payload and returns the created workout summary or identifier payload
- the workout creation schemas include fields for `training_plan_id`, `gym_id`, per-exercise references, selected load, and fixed or optional reps values needed by this slice
- executable verification: `rg -n "/api/gyms|POST:|post:|/api/workouts|GymSummary|CreateWorkout" agent/design/api-contract.yaml`

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/design/api-contract.yaml`
- `agent/design/domain-model.md`

## Out of Scope

- incremental per-set sync endpoints
- authentication or token changes


## Review Acceptance

- Criteria Met: `agent/design/api-contract.yaml` defines `GET /api/gyms` returning `GymSummary[]`, defines `POST /api/workouts` with `CreateWorkoutRequest` and `201` `WorkoutSummary`, and includes workout creation schemas covering `training_plan_id`, `gym_id`, per-exercise `training_plan_exercise_id`, selected option/variant/station references, `load_value`, and optional `reps` for the scoped single-set flow.
- Evidence: The contract includes `/api/gyms` at line 23, `/api/workouts` at line 79, `GymSummary` at line 147, `CreateWorkoutRequest` at line 165, `CreateWorkoutExerciseInput` at line 191, `CreateWorkoutSetInput` at line 219, and `WorkoutSummary` at line 302. This matches the vertical-slice plan and remains additive without introducing out-of-scope incremental sync endpoints.
- Runtime/Build Check: Executed `rg -n "/api/gyms|POST:|post:|/api/workouts|GymSummary|CreateWorkout" agent/design/api-contract.yaml` and observed matches for `/api/gyms`, `/api/workouts`, `post:`, `GymSummary`, `CreateWorkoutRequest`, `CreateWorkoutExerciseInput`, and `CreateWorkoutSetInput`.
- Residual Risk: A stale top-level API description still references a read-focused `pb-004` contract, but it does not conflict with the actual endpoint and schema definitions reviewed here.
