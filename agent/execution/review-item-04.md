# Add auth session check endpoint

## Goal

Implement `GET /auth/session` to validate the session cookie, enforce idle and absolute expiry rules, and return authenticated session state for app startup.

## Scope

- add backend handler for `GET /auth/session` that resolves session from cookie token hash
- enforce validity checks for `revoked_at`, `idle_expires_at`, and `absolute_expires_at`
- on valid session, update `last_seen_at` and extend `idle_expires_at` within configured limits
- return `401 Unauthorized` for missing or invalid session

## Acceptance Criteria

- `GET /auth/session` returns authenticated user payload when a valid non-expired session cookie is provided
- expired, revoked, missing, or invalid sessions return `401 Unauthorized`
- valid session checks update `last_seen_at` and slide idle expiry forward
- an executable verification step is documented and passes, for example `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `AUTH_CONCEPT.md`
- `agent/design/api-contract.yaml`
- `agent/strategy/security.md`
