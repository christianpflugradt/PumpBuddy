# Plan: Auth MVP with Session-Based Access

## Plan ID

pb-017

## Goal

Implement the auth concept from `AUTH_CONCEPT.md` so first use on a device requires an Access Key login, successful login creates a secure server-side session cookie, and all non-auth API usage is protected by session-based authentication with 7-day idle timeout and 90-day absolute lifetime.

## Scope

- add and migrate auth persistence model (`users`, `user_secrets`, `sessions`) with Argon2id-based secret hashing and server-side opaque session token hashing
- seed a development Access Key during `make rebuild-app` by generating a random token, printing it to CLI once, and inserting only its Argon2id hash into `user_secrets`
- implement `POST /auth/login` that validates Access Key, creates session state, sets secure cookie (`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`), and updates secret usage metadata
- implement `GET /auth/session` for app startup auth check, including session validity checks and sliding idle window updates
- enforce session authentication on all existing non-`/auth/*` API endpoints
- introduce login-first frontend behavior with Access Key-only login screen, startup session check, and no logout UI in this slice
- handle `401 Unauthorized` globally in frontend by returning to login screen without storing Access Key in app-managed persistent storage
- add `user_id` to all existing domain tables and enforce server-side ownership derivation from session rather than trusting client-provided identity

## Out of Scope

- frontend/logout endpoint or logout UI (`POST /auth/logout`) in this plan slice
- reauthentication flow (`/auth/reauth`) and UI
- multi-user login input (`login_name + access_key`) in UI flow (schema supports future expansion)
- access-key rotation admin tooling
- session history cleanup job and retention automation

## Success Criteria

- on a clean device with no valid session cookie, opening the app shows the Access Key login screen before protected content
- valid Access Key login creates a session and cookie; subsequent app opens on the same device do not prompt for login while session remains valid
- sessions expire after 7 days idle or 90 days absolute age and then require re-login
- all non-`/auth/*` endpoints reject unauthenticated requests with `401 Unauthorized`
- frontend transitions back to login view on `401` and does not persist Access Key in localStorage/sessionStorage/IndexedDB
- `make rebuild-app` prints one generated Access Key and inserts matching hashed secret into rebuilt database so immediate login works without manual DB steps
- all existing domain tables are user-scoped with `user_id`, and data access paths derive identity from valid session

## Constraints

- implement exactly the Access Key -> session-cookie architecture from `AUTH_CONCEPT.md`; no bearer-token frontend architecture
- use Argon2id for Access Key hashing and store encoded hash payload (no separate salt column requirement)
- maintain secure cookie properties: `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` (recommended name: `__Host-pb_session`)
- do not store cleartext Access Keys or cleartext session tokens in database or logs
- keep user-facing product copy in English
- no logout button in this plan; session ends only via expiry or browser/session clearing

## Inputs

- `AUTH_CONCEPT.md`
- `agent/design/use-cases.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
