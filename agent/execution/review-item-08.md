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
