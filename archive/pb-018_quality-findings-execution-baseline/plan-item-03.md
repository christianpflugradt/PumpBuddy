# Plan: Split Renderer Interaction and Persistence Coordination

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Move workout UI event routing and API persistence coordination out of `renderer/src/workout-controller.ts` into two focused modules (interaction and persistence) and wire them through a small controller wiring layer without changing observable behavior.

## Implementation Approach

- Add `renderer/src/workout-interaction.ts` to own DOM listener registration and event routing (start, resume, complete, cancel, user input events). Export a minimal interface for subscription/callbacks used by the controller.
- Add `renderer/src/workout-persistence.ts` to encapsulate save/resume API call sequencing, retry/backoff, and in-flight coordination. Expose `save`, `resume`, `cancel` operations and lifecycle events/promises.
- Refactor `renderer/src/workout-controller.ts` to delegate to the new modules: wire interaction events to persistence calls and compositional logic; the controller becomes a thin orchestration/wiring layer.
- Keep existing functions in `workout-render.ts` intact; update imports to use the new modules where necessary.
- Add unit tests or update existing tests under `renderer/test` to cover the wiring and ensure lifecycle flows remain unchanged. Run `npm --prefix renderer test` to verify.

## Risks and Assumptions

- Assumes current public API surface of persistence endpoints does not change; plan only reorganizes client-side code.
- Assumes DOM event matrix in `workout-controller.ts` can be cleanly separated; if there are tight cross-cutting concerns, a small adapter inside the controller may be required.

## Validation Plan

- Automated: `npm --prefix renderer test` must pass unchanged.
- Manual: exercise start, save, resume, complete, and cancel flows in the renderer and verify behavior matches current app (no visible regression or duplicate saves).
- Code review: ensure `renderer/src/workout-controller.ts` no longer contains the full event matrix or persistence sequencing logic.

## Out of Scope

- Introducing new API endpoints or changing server behavior.

## Handoff Notes for Implementation

- Keep commits small and focused: file extraction commits (interaction/persistence) followed by controller wiring commit.
- If any behavior change is necessary to simplify extraction, document it in the implementation output and add tests that assert the new behavior.
