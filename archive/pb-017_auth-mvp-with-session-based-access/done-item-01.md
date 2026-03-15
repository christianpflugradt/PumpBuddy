# Create auth persistence schema

## Goal

Add the database migration(s) that introduce auth persistence tables for users, access-key secrets, and sessions using the fields and constraints required by the auth concept.

## Scope

- create SQL migration files for `users`, `user_secrets`, and `sessions`
- enforce required keys, foreign keys, and nullable/non-nullable constraints from the plan and auth concept
- store access-key hashes and session token hashes as encoded/hash string fields only

## Acceptance Criteria

- migration files exist in the project migration location and define `users`, `user_secrets`, and `sessions` with required columns and relationships
- schema supports multiple historical secrets and multiple sessions per user
- an executable migration verification step is documented and passes, for example `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `AUTH_CONCEPT.md`
- `agent/design/domain-model.md`
- `agent/strategy/security.md`


## Review Acceptance

- Criteria Met: Backend auth persistence schema and migration files fully implement requirements for users, user_secrets, and sessions as defined in AUTH_CONCEPT.md, agent/strategy/plan.md, and review-item-01. All referenced table fields, relationships, historical secret support, multi-session capability, Argon2id-encoded fields, and constraints are present.
- Evidence: `backend/migrations/202603150001_create_auth_persistence.up.sql` and `.down.sql` define required tables and constraints precisely. Migration verification documented in `backend/migrations/README.md` and enforced via integration tests (`cargo test --manifest-path backend/Cargo.toml`), which pass with no errors. All acceptance criteria are validated against requirements and referenced templates.
- Runtime/Build Check: Migration verification via `cargo test --manifest-path backend/Cargo.toml` completes successfully; all relevant backend and migration integration tests pass.
- Residual Risk: None identified. Migration files and verification procedures satisfy referenced requirements, constraints, and acceptance criteria; full confidence in schema integrity and correctness.


## Review Acceptance

- Criteria Met: Backend auth persistence schema and migration files fully implement requirements for users, user_secrets, and sessions as defined in AUTH_CONCEPT.md, agent/strategy/plan.md, and review-item-01. All referenced table fields, relationships, historical secret support, multi-session capability, Argon2id-encoded fields, and constraints are present.
- Evidence: `backend/migrations/202603150001_create_auth_persistence.up.sql` and `.down.sql` define required tables and constraints precisely. Migration verification documented in `backend/migrations/README.md` and enforced via integration tests (`cargo test --manifest-path backend/Cargo.toml`), which pass with no errors. All acceptance criteria are validated against requirements and referenced templates.
- Runtime/Build Check: Executed `cargo test --manifest-path backend/Cargo.toml`; observed result: success with 39 tests passed (27 unit + 3 API integration + 9 persistence integration), 0 failed.
- Residual Risk: None identified. Migration files and verification procedures satisfy referenced requirements, constraints, and acceptance criteria; full confidence in schema integrity and correctness.
