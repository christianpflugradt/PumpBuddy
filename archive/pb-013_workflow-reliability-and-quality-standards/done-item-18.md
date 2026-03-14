# Renderer app.ts remains a mixed-responsibility monolith

## Summary

The renderer still relies on a single 1,584-line `app.ts` file that mixes transport DTOs, fetch helpers, state transitions, rendering, persistence orchestration, and DOM event handling, making future test additions and behavior changes expensive.

## Evidence

- `wc -l renderer/src/app.ts` reports 1,584 lines.
- `renderer/src/app.ts:28-209` defines transport-facing types and payload shapes.
- `renderer/src/app.ts:456-533` builds the API client in the same file that also renders screens.
- `renderer/src/app.ts:535-858` renders the UI, and `859-1584` also owns workflow orchestration plus click/change/input event handling.
- The renderer coverage failure in this review concentrates in the generated output from this file, which is consistent with the difficulty of exhaustively covering a single mixed-responsibility module.

## Goal

Refactor the renderer into smaller modules that separate API access, workout state/orchestration, and screen rendering so test seams become clearer and the main UI entrypoint stops accumulating unrelated logic.

## Scope

- extract API client and transport types out of `renderer/src/app.ts`
- separate workout state transitions and persistence orchestration from rendering helpers
- keep the existing lightweight renderer approach, but reduce the number of responsibilities owned by one file

## Acceptance Criteria

- renderer API/client code lives outside the primary UI composition module
- workout state/orchestration logic is separated from pure rendering helpers
- `renderer/src/app.ts` is no longer the default landing place for unrelated workout UI, API, and state changes

## References

- `renderer/src/app.ts`
- `renderer/src/app.test.ts`
- `renderer/src/main.ts`
- `agent/strategy/engineering-guardrails.md`


## Review Acceptance

- Criteria Met: API/client concerns are extracted to `renderer/src/workout-api.ts`, workout state/orchestration is split into `renderer/src/workout-state.ts` and `renderer/src/workout-controller.ts`, and `renderer/src/app.ts` is now a thin re-export surface rather than a mixed-responsibility landing file.
- Evidence: `renderer/src/app.ts` is 39 lines and only re-exports; orchestration/event workflow is centralized in `renderer/src/workout-controller.ts`; rendering helpers are isolated in `renderer/src/workout-render.ts`; transport/API code is isolated in `renderer/src/workout-api.ts`; shared domain/view/data types are isolated in `renderer/src/workout-types.ts`.
- Runtime/Build Check: Executed `npm test` in `renderer/`; observed `# pass 25`, `# fail 0` with all renderer tests succeeding.
- Residual Risk: none identified
