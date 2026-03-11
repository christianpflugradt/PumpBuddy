# Define Active Workout API Contract

## Goal

Extend the OpenAPI contract so the renderer and backend share a precise API for creating, updating, retrieving, completing, and cancelling an active workout.

## Scope

- update `agent/design/api-contract.yaml` with the active workout endpoints and schemas needed for incremental persistence and resume
- distinguish the first persisted write from later updates in the contract design
- include the response shape needed for the renderer to restore the current workout state after reload

## Acceptance Criteria

- `agent/design/api-contract.yaml` defines the active workout lifecycle endpoints needed for first-save, later-save, resume lookup, completion, and cancellation
- the contract encodes enough workout progress data for the renderer to restore the unfinished workout without inventing undocumented fields
- error responses for invalid or missing active workout operations are defined where relevant
- `rg -n "active workout|resume|cancel|complete" agent/design/api-contract.yaml` returns matches that cover the new lifecycle operations

## References

- `agent/strategy/plan.md`
- `agent/design/api-contract.yaml`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`

## Dependencies

- `item-0001`

## Out of Scope

- implementing backend handlers or frontend API calls


## Review Acceptance

- Criteria Met: `agent/design/api-contract.yaml` now defines active workout lifecycle endpoints for resume lookup (`GET /api/active-workout`), first-save creation (`POST /api/active-workout`), later-save updates (`PUT /api/active-workout/{workoutId}`), cancellation (`DELETE /api/active-workout/{workoutId}`), and completion (`POST /api/active-workout/{workoutId}/complete`). The contract also distinguishes first-save vs later-save with `CreateActiveWorkoutRequest.first_confirmed_exercise_position` and `UpdateActiveWorkoutRequest.last_confirmed_exercise_position`, and defines `404`/`409` error responses where the operations can fail because the active workout is missing or in an invalid state.
- Evidence: In commit `1d5b250`, the active workout routes were added under `/api/active-workout` and `/api/active-workout/{workoutId}` in `agent/design/api-contract.yaml`. The resume response shape includes `current_exercise_position`, `total_exercise_count`, and the full `exercises` array with selected option, variant, station, and set data, which is enough for the renderer to restore unfinished workout state without inventing undocumented fields.
- Runtime/Build Check: `ruby -e 'require "yaml"; YAML.load_file("agent/design/api-contract.yaml"); puts "YAML_OK"'` -> exited successfully and printed `YAML_OK`.
- Residual Risk: OpenAPI structure is valid YAML, but no dedicated OpenAPI linter/generator validation is present in the repository, so semantic validation against downstream tooling remains unverified.
