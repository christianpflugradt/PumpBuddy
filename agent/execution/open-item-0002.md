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
