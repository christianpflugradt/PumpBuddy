# Plan: Renderer Workout Start Screen Baseline

## Item Reference

- `agent/execution/open-item-0001.md`

## Goal Summary

Replace the renderer Hello World page with a static workout start screen that displays `Push Day` and a `Start Workout` action without relying on `/api/hello-world`.

## Implementation Approach

- Identify the current renderer entry view and remove the Hello World rendering path.
- Implement a static start screen view that includes the workout label `Push Day`.
- Add a single action control labeled `Start Workout` as the initial workout flow entrypoint.
- Keep displayed start-screen values hardcoded in renderer code for this baseline.

## Risks and Assumptions

- Assumes the current renderer structure allows replacing the Hello World flow without backend or API contract changes.
- Risk of leaving unused Hello World code paths behind; cleanup should keep behavior focused on the new static start view.

## Validation Plan

- Verify the renderer UI shows `Push Day` and `Start Workout` and no longer shows the previous Hello World flow.
- Confirm the start screen renders without requiring a request to `/api/hello-world` (code inspection and runtime network check if needed).
- Run `cd renderer && npm run build` and confirm it exits successfully.

## Out of Scope

- Dynamic workout data loading or API-backed start-screen content.
- Changes to backend endpoints, API contracts, or authentication behavior.
- Additional workout actions beyond the single `Start Workout` control.

## Handoff Notes for Implementation

- Preserve the existing stack and architecture boundaries: renderer-only UI change, no new framework or backend dependency.
- Keep the implementation lightweight and static to match the baseline item intent.
