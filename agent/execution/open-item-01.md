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
