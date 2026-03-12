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


## Review Acceptance

- Criteria Met: The backend no longer exposes `GET /api/hello-world`, the canonical OpenAPI contract no longer documents the endpoint or `HelloWorldResponse`, and active product docs now describe only the workout slice. The active tree also contains no `hello-world` or `Hello World` matches under `backend`, `renderer`, or `agent/design/api-contract.yaml`.
- Evidence: `backend/src/main.rs` removes the `/api/hello-world` route and handler, `backend/src/persistence.rs` removes the bootstrap-only repository method, `agent/design/api-contract.yaml` removes `/api/hello-world` and `HelloWorldResponse`, and `agent/design/use-cases.md` removes the obsolete Hello World use case. The added backend test `app_router_no_longer_exposes_removed_bootstrap_endpoint` verifies the removed route returns `404`.
- Runtime/Build Check: `cargo test --manifest-path backend/Cargo.toml` passed with 40 tests passing and 0 failing; `npm test --prefix renderer` passed with 13 tests passing and 0 failing; `rg -n "hello-world|Hello World" backend renderer agent/design/api-contract.yaml` returned no matches.
- Residual Risk: none identified
