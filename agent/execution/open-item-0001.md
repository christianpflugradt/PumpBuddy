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
