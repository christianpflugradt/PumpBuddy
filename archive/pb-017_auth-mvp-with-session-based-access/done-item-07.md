# Add renderer login-first app boot flow

## Goal

Update the renderer startup flow to require authentication first by checking session state and showing an Access Key login view before protected app content.

## Scope

- add startup call to `GET /auth/session` before loading protected workout UI
- implement Access Key-only login screen and login submission to `POST /auth/login`
- route to protected app state only after successful session check or login
- keep user-facing auth copy in English

## Acceptance Criteria

- opening the app without valid session displays the Access Key login view before protected content
- valid login transitions the UI into the authenticated app flow without requiring page reload
- reopening app with an existing valid session bypasses login screen and loads protected app flow
- an executable verification step is documented and passes, for example `npm --prefix renderer test --`

## References

- `agent/strategy/plan.md`
- `AUTH_CONCEPT.md`
- `agent/design/use-cases.md`
- `renderer/src/pumpbuddy-app.ts`


## Review Acceptance

- Criteria Met: Opening the app without a valid session shows the Access Key login view; a valid login transitions into the authenticated app flow without a page reload; reopening with an existing valid session bypasses the login screen and loads the protected app flow; automated renderer tests execute.
- Evidence: `renderer/src/auth-gate.ts` performs a `GET /auth/session` during init and renders the login view via `renderer/src/login-component.ts` when unauthorized; `submitAccessKey` posts to `POST /auth/login` and calls `initApp` on success; unit tests covering the auth gate and login flow are present and passing.
- Runtime/Build Check: `npm --prefix renderer test --` → tests: 30 passed, 0 failed (TAP output showing 30 tests, all ok; total duration ~95ms).
- Residual Risk: Minimal — integration/e2e in a real browser and backend availability are not exercised by unit tests; otherwise none identified.
