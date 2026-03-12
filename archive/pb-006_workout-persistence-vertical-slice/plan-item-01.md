# Plan: Extend Workout Slice API Contract

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Add the minimal OpenAPI contract needed for seeded gym selection and completed workout creation in the current workout persistence slice.

## Implementation Approach

- extend `agent/design/api-contract.yaml` with `GET /api/gyms` returning seeded gym summaries
- add `POST /api/workouts` with a request schema for completed workout submission and a response schema for the created workout result
- define only the schema fields needed by this slice: `training_plan_id`, `gym_id`, per-exercise references, selected load, and fixed or optional reps values
- keep naming and response shapes aligned with existing contract patterns such as summary objects and reusable component schemas

## Risks and Assumptions

- the contract should stay narrow and avoid introducing incremental sync concepts that belong to later items
- per-exercise payload fields must be explicit enough for backend persistence without overcommitting to future richer workout editing flows
- existing summary schemas may need small reuse-oriented adjustments if `POST /api/workouts` returns a workout summary instead of only an identifier

## Validation Plan

- review the updated YAML for consistent OpenAPI structure and schema references
- run `rg -n "/api/gyms|POST:|post:|/api/workouts|GymSummary|CreateWorkout" agent/design/api-contract.yaml`

## Out of Scope

- incremental per-set sync endpoints or command-style workout orchestration
- authentication, token, or broader workflow contract changes
- backend or renderer implementation beyond what is necessary to define the canonical API contract

## Handoff Notes for Implementation

- preserve the contract-first approach: the OpenAPI YAML remains the canonical source
- prefer additive schema changes that support the current vertical slice without locking in premature domain detail
