# PB-013 Backend Structure Review

## Scope

Reviewed the backend entrypoint, persistence boundary, and integration-test layout against the updated maintainability and testing standards in:

- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

Files inspected:

- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/tests/persistence_integration.rs`

## Structural Findings

### 1. `backend/src/main.rs` is an oversized mixed-responsibility boundary

- Evidence:
  - `backend/src/main.rs` is 2,758 lines.
  - Startup and routing stay near the thin-entrypoint boundary at [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L226) and [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L278), but the same file also owns request DTO definitions, handler implementations, payload-to-domain validation, repository-backed validation, response mapping, CLI help text, and a very large in-file test module beginning at [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L1022).
  - The active-workout request validation path alone spans multiple sections from [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L600) through [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L911), mixing transport models, validation rules, and repository lookups.
  - API response shaping also remains in the entrypoint at [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L934).
- Risk:
  - This violates the guardrail that `main.rs` remain an entrypoint rather than the default landing place for unrelated backend work.
  - Future changes to handlers, validation, or response contracts will keep increasing the blast radius of a single file and make focused review harder.
- Recommended follow-up:
  - Split `main.rs` into dedicated transport-facing modules such as router wiring, handler functions, payload validation/mapping, and response serialization while keeping `main.rs` limited to startup and dependency assembly.

### 2. Handler flows depend directly on persistence-oriented validation helpers

- Evidence:
  - `create_workout`, `create_active_workout`, `update_active_workout`, and `complete_active_workout` each call validation functions that depend on `DomainRepository` from the transport layer at [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L407), [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L443), [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L464), and [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L486).
  - The helper functions at [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L864) and [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L886) embed repository calls directly into entrypoint-owned validation.
- Risk:
  - The transport layer currently owns both HTTP concerns and cross-record business validation, which weakens separation between transport and application logic.
  - This makes later reuse of workout validation rules outside the HTTP boundary harder.
- Recommended follow-up:
  - Move repository-backed workout validation into a dedicated service or application module that handlers call, leaving handler code responsible only for transport concerns.

### 3. `DomainRepository` is too broad to be an easy persistence seam

- Evidence:
  - `backend/src/persistence.rs` is 1,288 lines and one `DomainRepository` impl owns training-plan reads, gym reads, workout summary reads, workout creation, active-workout lifecycle writes, active-workout resume queries, and historical suggestion lookup from [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L31) through [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L901).
  - Active-workout persistence combines workflow rules and SQL details in the same boundary. For example, `create_active_workout` starts with uniqueness checks, then persists rows, then rehydrates a domain response in one method beginning at [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L410).
  - Read assembly paths like `fetch_training_plan` and `fetch_active_workout` both manually stitch multi-query aggregates with mutable indexing maps at [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L36) and [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L717).
- Risk:
  - A single repository type now represents multiple subdomains and both simple reads and workflow-sensitive writes, so changes in one area increase review and regression surface across the whole persistence layer.
  - The current shape does not provide narrow seams for future targeted tests or refactors.
- Recommended follow-up:
  - Split persistence by feature-oriented boundaries, at minimum separating training-plan or gym reads from workout or active-workout persistence, and consider extracting shared row-to-domain assembly helpers where query stitching repeats.

## Test-Seam Findings

### 4. Integration tests silently skip when infrastructure is unavailable

- Evidence:
  - `TestDatabase::provision()` returns `Option<Self>` at [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L25), and each test exits early when it gets `None`, for example at [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L167), [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L259), and [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L317).
  - `docker_socket_exists()` and `docker_unavailable()` intentionally treat missing Docker access as a skip path at [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L78) and [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L89).
- Risk:
  - The test strategy calls for meaningful PostgreSQL-backed coverage. Returning early makes a green test run ambiguous because persistence coverage can disappear without failing the suite.
- Recommended follow-up:
  - Make the repository’s required integration coverage explicit in the test outcome. If the project intends tests to be optional in some environments, report that as an explicit ignored or gated condition rather than a silent success path.

### 5. Persistence test harness logic is duplicated across files

- Evidence:
  - `backend/tests/persistence_integration.rs` defines its own container provisioning, retry logic, schema initialization, and active-workout fixture at [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L20), [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L96), [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L130), and [backend/tests/persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L137).
  - `backend/src/persistence.rs` contains a separate in-file test module with its own lock, fixture, optional pool setup, and schema checks beginning at [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L911).
  - `backend/src/main.rs` also contains database-aware API tests with its own `maybe_pool`, `schema_ready`, and test app helpers beginning at [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L1042).
- Risk:
  - The current test seam is not durable. Infrastructure behavior, schema bootstrapping, and fixture assumptions can drift independently across three places.
  - Fixing one flaky setup path will require auditing multiple modules instead of one shared harness.
- Recommended follow-up:
  - Consolidate backend database test support into shared test utilities so persistence and API integration tests use the same provisioning, readiness, and fixture setup path.

### 6. The largest API tests live inside the entrypoint file instead of at the integration boundary

- Evidence:
  - `backend/src/main.rs` contains unit-style validation tests and full router-level request or response tests in the same module, including end-to-end API flows around [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L2313) and [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L2557).
  - Those tests depend on runtime database availability through `maybe_pool()` and `schema_ready()` at [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L1042).
- Risk:
  - This keeps the entrypoint file large and couples transport tests to internal module layout instead of a clearer integration-test boundary.
  - The in-file placement makes it harder to distinguish pure unit tests from infrastructure-backed API tests.
- Recommended follow-up:
  - Keep small transport or validation unit tests near the code they exercise, but move router-plus-database scenarios into dedicated integration-test modules that share the common database harness.

## Summary

The backend currently works, but it does not yet meet the newer maintainability standard of thin entrypoints and narrowly scoped backend modules. The highest-value follow-up work is to:

1. Thin `backend/src/main.rs` into transport-focused modules.
2. Split `DomainRepository` into narrower persistence boundaries.
3. Consolidate database-backed test infrastructure and remove silent skip behavior for required integration coverage.
