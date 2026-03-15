# Add user ownership columns and scoping

## Goal

Introduce `user_id` ownership on existing domain tables and update backend data access so reads and writes are scoped by user identity derived from session.

## Scope

- add migrations to include required `user_id` columns and foreign keys on existing domain tables
- update backend persistence queries to include user scoping on reads and writes
- ensure handlers derive owner identity from authenticated session context, not request payload

## Acceptance Criteria

- existing domain tables include `user_id` columns with appropriate relational constraints
- data access paths enforce user ownership scoping and do not return cross-user data
- server ignores or rejects client-provided identity fields for ownership decisions
- an executable verification step is documented and passes, for example `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `AUTH_CONCEPT.md`
- `agent/design/domain-model.md`
- `agent/strategy/security.md`
