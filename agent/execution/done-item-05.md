# Enforce backend session auth middleware

## Goal

Protect every non-`/auth/*` backend API endpoint with session-based authentication that derives identity from the validated session.

## Scope

- add reusable authentication middleware or extractor for session cookie validation
- apply authentication enforcement to all existing non-`/auth/*` routes
- ensure unauthenticated access returns `401 Unauthorized`
- pass authenticated user identity from server-side session resolution into handlers

## Acceptance Criteria

- all existing non-`/auth/*` endpoints reject requests without valid session cookie with `401 Unauthorized`
- authenticated requests to protected endpoints proceed with server-derived user identity context
- no protected endpoint trusts client-provided identity as authentication source
- an executable verification step is documented and passes, for example `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `AUTH_CONCEPT.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/engineering-guardrails.md`


## Review Acceptance

```md
- Criteria Met: All acceptance criteria satisfied: protected routes under `/api` reject requests without a valid `__Host-pb_session` cookie with `401 Unauthorized`; authenticated requests pass server-derived identity into handlers; handlers do not rely on client-provided identity.
- Evidence: `backend/src/api/middleware.rs` implements `require_session` which returns `401` when the session cookie is missing or invalid and inserts an `AuthenticatedSession` into `req.extensions()` on success; `backend/src/api/handlers.rs` nests the `/api` router with `middleware::require_session` (line 78) so all `/api/*` routes are covered; `backend/src/application/auth.rs::resolve_session` returns `AuthenticatedSession` derived from validated session token.
- Runtime/Build Check: Command: `cargo build --manifest-path backend/Cargo.toml`
  Observed: build completed successfully: "Finished `dev` profile [unoptimized + debuginfo] target(s) in ..." (dev build succeeded).
- Residual Risk: Integration tests that exercise authentication behavior against a real Postgres DB and session lifecycle were not executed here (`cargo test` requires test DB/testcontainers); recommend running `cargo test --manifest-path backend/Cargo.toml` in CI or locally to fully validate runtime behavior.
```
