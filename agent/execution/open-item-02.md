# Split Renderer Workflow Orchestration Module

## Goal

Extract workout workflow orchestration from the monolithic renderer controller into a dedicated module that owns start, save, resume, complete, and cancel transitions.

## Scope

- create a dedicated renderer workflow orchestration module with explicit interfaces
- move transition orchestration logic out of `workout-controller.ts` into the new module
- keep presentation rendering and event binding behavior unchanged
- update composition wiring so `workout-controller.ts` no longer acts as the end-to-end workflow surface

## Acceptance Criteria

- workflow transition logic exists in a dedicated module and is invoked through explicit interfaces
- `renderer/src/workout-controller.ts` no longer contains full workflow orchestration logic
- workout start, save, resume, complete, and cancel behavior remains functionally unchanged
- executable verification: `npm --prefix renderer test`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `renderer/src/workout-controller.ts`
- `renderer/src/workout-state.ts`
- `renderer/src/workout-render.ts`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `open-item-03.md`
- `open-item-04.md`

## Out of Scope

- API contract changes
- visual redesign of workout screens
