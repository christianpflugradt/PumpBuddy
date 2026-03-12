# Add Minimal API Preparation for Domain Entities

## Goal

Prepare the backend/API surface for pb-004 entities with minimal, non-orchestrating contract and handler scaffolding to reduce integration effort in later plans.

## Scope

- update `agent/design/api-contract.yaml` with minimal read-focused placeholders for core domain discovery flows (plans/options/workout summaries), without wizard orchestration endpoints
- add backend route and handler scaffolding aligned with the updated contract
- wire handler responses to new persistence abstractions where practical, keeping payloads minimal and stable
- preserve existing security and boundary constraints (renderer public, backend private)

## Acceptance Criteria

- API contract includes minimal pb-004 entity preparation endpoints and schemas consistent with domain terminology
- backend compiles with route/handler scaffolding for the new contract entries
- executable verification:
  `cd backend && cargo check`
- executable verification:
  `cd backend && cargo test`

## References

- `agent/strategy/plan.md`
- `agent/design/domain-model.md`
- `agent/design/api-contract.yaml`
- `agent/strategy/security.md`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-03`

## Out of Scope

- full workout wizard state machine and command workflow
- renderer feature integration for new endpoints


## Review Acceptance

- Criteria Met: API contract includes minimal pb-004 read-focused endpoints/schemas (`/api/training-plans`, `/api/training-plans/{trainingPlanId}/options`, `/api/workouts/{workoutId}/summary`) aligned with domain terminology; backend route and handler scaffolding is present for those endpoints in `backend/src/main.rs`; responses are wired through persistence abstractions in `backend/src/persistence.rs` with minimal stable payload DTOs.
- Evidence: Contract updates are present in `agent/design/api-contract.yaml`; backend routes and handlers for `list_training_plans`, `list_training_plan_options`, and `get_workout_summary` are implemented in `backend/src/main.rs`; repository methods `fetch_training_plan_summaries`, `fetch_plan_exercise_option_summaries`, and `fetch_workout_summary` provide the handler data path in `backend/src/persistence.rs`; no wizard orchestration endpoints were added.
- Runtime/Build Check: `cd backend && cargo check` completed successfully (exit 0, warnings only). `cd backend && cargo test` completed successfully (exit 0; 4 passed, 0 failed).
- Residual Risk: low; current warnings indicate currently unused domain/persistence types but do not block this preparatory scope.
