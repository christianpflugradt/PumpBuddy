# Add Targeted Persistence and Initialization Tests

## Goal

Add targeted automated tests that validate schema initialization and primary SQLx persistence behavior for pb-004.

## Scope

- add backend integration tests that run against PostgreSQL and validate:
  - initialization from `backend/init.sql`
  - required seed invariants (gym/plan counts, exercise counts per plan, variant-option differences)
  - representative persistence read/write paths for workouts and sets
- keep test coverage focused on high-value persistence behaviors rather than broad endpoint simulation
- ensure tests are reproducible in local and CI-style environments

## Acceptance Criteria

- integration tests fail when schema/seed invariants for pb-004 are violated
- integration tests cover at least one representative persistence write path and one read path for workout data
- executable verification:
  `cd backend && cargo test`
- executable verification:
  `docker compose up --build -d && docker compose exec -T backend cargo test && docker compose down`

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/design/domain-model.md`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-0003`
- `item-0004`

## Out of Scope

- broad frontend E2E coverage for workout flows
- performance/load testing


## Review Findings

### Criterion

executable verification: `docker compose up --build -d && docker compose exec -T backend cargo test && docker compose down`

- Status: fail
- Evidence: Executed the exact command from the acceptance criteria at repository root. Compose started successfully and built images, but `docker compose exec -T backend cargo test` failed with `OCI runtime exec failed: exec failed: unable to start container process: exec: "cargo": executable file not found in $PATH` because the `backend` service image is a runtime image without Rust toolchain binaries.
- Risk: The required CI-style container verification path is not reproducible as specified. This leaves a gap between local host test execution and containerized validation, increasing the chance of release/runtime regressions going undetected in the intended environment.


## Review Acceptance

- Criteria Met: Added backend integration tests validate init.sql-driven schema/seed invariants for pb-004 and cover representative persistence read/write workout paths.
- Evidence: `backend/tests/persistence_integration.rs` includes `seed_invariants_match_pb004_requirements`, `option_read_path_is_gym_specific`, and `workout_write_and_read_paths_round_trip`, asserting gym/plan/exercise invariants, gym-specific option differences, and workout create/fetch/summary persistence behavior.
- Runtime/Build Check: `cd backend && cargo test` passed (unit + integration: 7 tests passed, 0 failed); `docker compose up --build -d && docker compose exec -T backend cargo test && docker compose down` passed with containerized backend test run succeeding and services/network torn down cleanly.
- Residual Risk: low; SQL/seed coverage is targeted to key pb-004 invariants and representative paths, but not exhaustive for every persistence query variant.
