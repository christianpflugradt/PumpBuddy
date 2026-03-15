# Plan: Add auth session check endpoint

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Implement `GET /auth/session` to validate the session cookie, enforce idle/absolute expiry, update session activity, and return authenticated session state for app startup.

## Implementation Approach

- add `/auth/session` route wiring and a dedicated handler module, keeping `backend/src/main.rs` focused on routing
- read the session token from the secure cookie, hash it, and load the matching session plus user data via SQLx
- enforce validity checks (`revoked_at`, `idle_expires_at`, `absolute_expires_at`); return `401` for missing/invalid/expired
- on valid session, update `last_seen_at` and slide `idle_expires_at` forward within configured limits, then return session/user payload
- update OpenAPI contract for `/auth/session` response shape if not already defined

## Risks and Assumptions

- assumes session issuance already stores hashed token and expiry timestamps in the sessions table
- ensure no logging of cleartext session tokens or cookies

## Validation Plan

- add integration tests covering valid session, revoked session, idle expiry, and absolute expiry
- run `cargo test --manifest-path backend/Cargo.toml`

## Out of Scope

- login endpoint changes
- logout or session revocation endpoints
- frontend session-check UI logic

## Handoff Notes for Implementation

- keep persistence in SQLx and separate handler/business/persistence concerns
- ensure session updates do not extend beyond absolute expiry
