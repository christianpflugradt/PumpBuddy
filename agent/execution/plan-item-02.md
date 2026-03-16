# Plan: Split Renderer Workflow Orchestration Module

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Extract workout workflow orchestration from the monolithic renderer controller into a dedicated module that owns start, save, resume, complete, and cancel transitions while preserving existing presentation and event binding behaviour.

## Implementation Approach

- Add a new module `renderer/src/workflow-orchestrator.ts` that exposes an explicit interface for `start`, `save`, `resume`, `complete`, and `cancel` transitions.
- Move orchestration logic and transition sequencing out of `renderer/src/workout-controller.ts` into the new module, keeping the controller responsible only for presentation wiring and event delegation.
- Reuse `renderer/src/workout-state.ts` and `renderer/src/workout-render.ts` APIs inside the orchestrator rather than copying state/renderer logic.
- Update `renderer/src/workout-controller.ts` to delegate workflow calls to the orchestrator and forward rendering/event hooks unchanged.
- Add or update tests under `renderer/` to cover transition behavior; run `npm --prefix renderer test` to validate no behavioral regressions.

## Risks and Assumptions

- Assumes orchestration code in `workout-controller.ts` is reasonably separable (no heavy private closure coupling).
- Risk: subtle timing or subscription differences may change behavior; preserve existing event ordering and cancellation semantics.

## Validation Plan

- Automated: `npm --prefix renderer test` must pass.
- Manual: exercise workout flows in the renderer UI and verify start, save, resume, complete, and cancel behave identically to current behaviour (quick smoke scenarios).

## Out of Scope

- API contract changes.
- Visual redesign of workout screens.

## Handoff Notes for Implementation

- Keep the orchestrator surface minimal and documented in a short file header.
- Preserve existing exported names where other modules depend on them to avoid broad refactors.
- If extraction requires small adapter helpers, keep them in the orchestrator module rather than returning logic to the controller.
- Run the renderer test suite and a quick manual smoke after changes; note any intentional deviations in the implementation output.
