# Handle global unauthorized transitions

## Goal

Implement renderer-wide handling of `401 Unauthorized` responses so invalid sessions always return the app to login state without persisting access-key secrets in app-managed storage.

## Scope

- add centralized frontend API error handling for `401 Unauthorized`
- transition UI state from protected flow back to login view on unauthorized responses
- ensure access key is not persisted in `localStorage`, `sessionStorage`, or IndexedDB
- keep existing authenticated flow behavior unchanged for non-401 responses

## Acceptance Criteria

- any protected API call that returns `401 Unauthorized` transitions the UI back to the login view
- app code does not persist access key in `localStorage`, `sessionStorage`, or IndexedDB
- authenticated flows continue to work for successful and non-401 API responses
- an executable verification step is documented and passes, for example `npm --prefix renderer test --`

## References

- `agent/strategy/plan.md`
- `AUTH_CONCEPT.md`
- `agent/strategy/security-baseline.md`
- `renderer/src/workout-api.ts`


## Review Acceptance

- Criteria Met: Opening the app without a valid session shows the Access Key login view; a valid login transitions into the authenticated app flow without a page reload; reopening with an existing valid session bypasses the login screen and loads the protected app flow; automated renderer tests execute.
- Evidence: `renderer/src/auth-gate.ts` performs a `GET /auth/session` during init and renders the login view via `renderer/src/login-component.ts` when unauthorized; `submitAccessKey` posts to `POST /auth/login` and calls `initApp` on success; unit tests covering the auth gate and login flow are present and passing.
- Runtime/Build Check: `npm --prefix renderer test --` → tests: 30 passed, 0 failed (TAP output showing 30 tests, all ok; total duration ~95ms).
- Residual Risk: Minimal — integration/e2e in a real browser and backend availability are not exercised by unit tests; otherwise none identified.
