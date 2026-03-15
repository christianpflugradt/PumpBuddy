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
