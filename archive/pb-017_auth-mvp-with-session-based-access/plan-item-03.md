# Plan: Implement login session issuance endpoint

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Implement `POST /auth/login` to validate the Access Key, create a server-side session, set the secure session cookie, and update secret usage metadata per the auth concept.

## Implementation Approach

- add the `/auth/login` route wiring in the backend router and create a dedicated handler module (keep `backend/src/main.rs` thin)
- load the active `user_secrets` record, verify the provided Access Key with Argon2id, and return `401` on mismatch
- generate an opaque session token, hash it before storage, persist a new session row with required expiry fields, and update `user_secrets.last_used_at`
- set the session cookie with required attributes (`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, likely `__Host-pb_session`) and avoid logging cleartext tokens
- update or extend the OpenAPI contract for the `/auth/login` endpoint payload/response if not already specified

## Risks and Assumptions

- assume auth persistence models and helper utilities already exist or will be added without changing schema scope
- ensure no logs capture the Access Key or session token, especially in error paths

## Validation Plan

- add or update backend tests covering successful and invalid Access Key login (integration tests if DB/session persistence is involved)
- run `cargo test --manifest-path backend/Cargo.toml`

## Out of Scope

- logout or reauthentication endpoints
- frontend login UI or session check changes
- access-key rotation tooling

## Handoff Notes for Implementation

- follow security boundary rules: no public maintenance endpoints; use server-side session issuance only
- use SQLx for persistence and keep handler/business/persistence concerns in separate modules
