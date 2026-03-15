# Plan: Enforce backend session auth middleware

## Item Reference

- `agent/execution/open-item-05.md`

## Goal Summary

Ensure every non-`/auth/*` backend API endpoint requires a valid session cookie, derives user identity server-side from that session, and returns `401 Unauthorized` when unauthenticated.

## Implementation Approach

- Audit existing backend routing to enumerate all non-`/auth/*` endpoints and identify any current auth checks or identity inputs.
- Implement or extend a reusable session authentication extractor/middleware that validates the session cookie and yields a server-derived user identity context.
- Apply the auth enforcement uniformly to all non-`/auth/*` routes (router nesting or per-route guards), ensuring handlers receive the derived identity and do not accept client-provided identity.
- Update handlers to consume the new identity context where needed and remove any client-supplied identity usage.

## Risks and Assumptions

- Assumes a session validation utility already exists or will be added in the backend auth module; if missing, add it alongside middleware.
- Route structure may require careful router nesting to avoid missing edge endpoints; confirm coverage of all non-`/auth/*` routes.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml`.
- Add or adjust a backend test to cover unauthenticated access returning `401` for at least one protected endpoint if current coverage is insufficient.

## Out of Scope

- Changes to `/auth/*` endpoint behavior beyond required session validation utilities.
- New auth UI or frontend behavior changes.

## Handoff Notes for Implementation

- Keep `backend/src/main.rs` focused on routing/wiring; place middleware/extractor in a dedicated auth module if not already present.
- Preserve security baseline: never trust client-provided identity; derive identity solely from validated session.
