# Implement login session issuance endpoint

## Goal

Implement `POST /auth/login` to validate the access key, create a server-side session, and issue the secure session cookie required by the auth architecture.

## Scope

- add backend login request and response handling for `POST /auth/login`
- verify submitted access key against active secret hash using Argon2id verification
- create a new session record with hashed opaque token and required expiry fields
- set session cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`
- update `user_secrets.last_used_at` on successful login

## Acceptance Criteria

- `POST /auth/login` returns success only for valid access key and `401 Unauthorized` for invalid access key
- successful login creates a new session record and returns a secure session cookie with required attributes
- session token cleartext is not stored in database or logs
- an executable verification step is documented and passes, for example `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `AUTH_CONCEPT.md`
- `agent/design/api-contract.yaml`
- `agent/strategy/security.md`


## Review Acceptance

```md
- Criteria Met: Implemented `POST /auth/login` that validates access key, creates a hashed server-side session record, sets a `__Host-pb_session` cookie with `Path=/; Secure; HttpOnly; SameSite=Strict`, and updates `user_secrets.last_used_at` on success.
- Evidence: Backend handler at `backend/src/api/auth.rs` wires `POST /auth/login` and calls `login_with_access_key`; persistence logic stores only the session token hash (`create_login_session` in `backend/src/persistence/auth.rs`) and updates `last_used_at`.
- Runtime/Build Check: Command: `cargo test --manifest-path backend/Cargo.toml`
  Observed: All backend tests passed (total across suites: 45 passed; 0 failed), exit code 0.
- Residual Risk: None identified beyond expected client-side exposure of the cookie value; server does not persist or log cleartext session tokens.
```
