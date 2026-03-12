# Refactor Backend Boundaries

## Goal

Implement the highest-value backend structural refactors identified by the review so the service has thinner entrypoints and clearer module boundaries without unnecessary architecture churn.

## Scope

- refactor oversized backend boundaries called out by the review, especially around `backend/src/main.rs`
- move logic into clearer modules or seams while preserving current behaviour and API contract
- keep the refactor aligned with the updated engineering guardrails and the existing Rust, Axum, and SQLx stack

## Acceptance Criteria

- the committed backend structure resolves the review's highest-priority modularity findings without changing the documented workout behaviour
- backend entrypoint responsibilities are narrower after the refactor, with extracted module boundaries where the review identified oversized ownership
- `cargo test --manifest-path backend/Cargo.toml` passes

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/design/api-contract.yaml`
- `agent/design/use-cases.md`
- `backend/src/main.rs`
- `agent/tmp/pb-013-backend-structure-review.md`

## Dependencies

- `item-05`

## Out of Scope

- changing product behaviour beyond what is necessary to preserve current functionality during the refactor
- raising backend coverage through unrelated low-value tests
