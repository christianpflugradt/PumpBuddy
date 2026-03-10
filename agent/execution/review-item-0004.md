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

- `item-0003`

## Out of Scope

- full workout wizard state machine and command workflow
- renderer feature integration for new endpoints
