# Implement SQLx Domain Persistence Foundations

## Goal

Introduce backend Rust domain and persistence foundations for the pb-004 model using SQLx and explicit SQL.

## Scope

- replace runtime bootstrap table creation in backend startup with initialization flow based on `backend/init.sql`
- add Rust domain structs and persistence mappings for core entities needed to read/write:
  - training plans and ordered plan exercises
  - exercises, variants, gyms, and gym-specific plan exercise options
  - workouts, workout exercises, and workout sets
- add SQLx-backed repository/data-access modules with explicit SQL queries
- keep persistence logic separated from HTTP handler wiring

## Acceptance Criteria

- backend no longer relies on inline SQL table creation for the domain foundation and uses `init.sql`-initialized schema
- SQLx data-access layer can persist and retrieve at least one representative aggregate path (`training_plan` with exercises, `workout` with sets)
- executable verification:
  `cd backend && cargo check`
- executable verification:
  `cd backend && cargo test`

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/design/domain-model.md`

## Dependencies

- `item-0001`
- `item-0002`

## Out of Scope

- full workout wizard orchestration
- renderer integration with domain entities


## Review Acceptance

- Criteria Met: Backend startup no longer creates tables inline and now assumes schema provisioned externally; SQLx-based repository methods implement representative aggregate persistence/retrieval for `training_plan` (with ordered exercises and options) and `workout` (with exercises and sets).
- Evidence: `backend/src/main.rs` only initializes config, database pool, and routing with no runtime DDL path; schema and seed definitions are provided in `backend/init.sql`; `backend/src/persistence.rs` includes explicit SQLx queries for `fetch_training_plan`, `create_workout`, and `fetch_workout`, and tests exercise training plan hydration and workout round-trip with sets.
- Runtime/Build Check: `cd backend && cargo check` completed successfully (warnings only, no errors); `cd backend && cargo test` completed successfully with `2 passed; 0 failed`.
- Residual Risk: Integration tests are environment-gated by DB availability and can silently skip when `TEST_DATABASE_URL`/`DATABASE_URL` is missing or schema is absent, which may reduce CI confidence if not explicitly provisioned.
