# Remove Hello World Bootstrap Surface

## Goal

Remove the obsolete Hello World API and UI remnants so the active product slice only exposes workout-related behaviour.

## Scope

- remove the Hello World backend endpoint and any backend code paths that only support that bootstrap slice
- remove renderer code and assets that still depend on the Hello World bootstrap flow
- update the OpenAPI contract so it no longer documents the Hello World endpoint or obsolete bootstrap-only schemas
- add or update checks that cover the cleaned-up backend and renderer startup paths

## Acceptance Criteria

- the application no longer exposes `GET /api/hello-world` in code or in `agent/design/api-contract.yaml`
- renderer startup no longer contains a Hello World bootstrap path
- `rg -n "hello-world|Hello World" backend renderer agent/design/api-contract.yaml` returns no matches that describe an active product surface
- `cargo test --manifest-path backend/Cargo.toml` and `npm test --prefix renderer` pass

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/design/api-contract.yaml`
- `agent/design/use-cases.md`

## Notes for Review

- Review should allow historical references under `archive/` but should reject active-surface references under backend, renderer, or the canonical API contract.
