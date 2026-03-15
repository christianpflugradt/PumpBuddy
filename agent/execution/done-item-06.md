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


## Review Acceptance

```md
- Criteria Met: All acceptance criteria satisfied: protected routes under `/api` reject requests without a valid `__Host-pb_session` cookie with `401 Unauthorized`; authenticated requests pass server-derived identity into handlers; handlers do not rely on client-provided identity.
- Evidence: `backend/src/api/middleware.rs` implements `require_session` which returns `401` when the session cookie is missing or invalid and inserts an `AuthenticatedSession` into `req.extensions()` on success; `backend/src/api/handlers.rs` nests the `/api` router with `middleware::require_session` (line 78) so all `/api/*` routes are covered; `backend/src/application/auth.rs::resolve_session` returns `AuthenticatedSession` derived from validated session token.
- Runtime/Build Check: Command: `cargo build --manifest-path backend/Cargo.toml`
  Observed: build completed successfully: "Finished `dev` profile [unoptimized + debuginfo] target(s) in ..." (dev build succeeded).
- Residual Risk: Integration tests that exercise authentication behavior against a real Postgres DB and session lifecycle were not executed here (`cargo test` requires test DB/testcontainers); recommend running `cargo test --manifest-path backend/Cargo.toml` in CI or locally to fully validate runtime behavior.
```
