# Plan: Clarify Workout Action Dialog Labels

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Replace generic confirmation action labels in the workout flow with explicit, outcome-based wording so users can decide faster with less ambiguity.

## Implementation Approach

- Identify workout-flow confirmation dialogs currently using generic action labels (for finish, cancel, and skip paths) in `renderer/src/workout-render.ts`.
- Replace generic labels with explicit action-specific labels (`Finish Workout`, `Cancel Workout`, `Skip Exercise`) while keeping existing dialog triggers and confirmation logic unchanged.
- Ensure the same wording pattern is applied consistently anywhere these workout confirmation actions appear.

## Risks and Assumptions

- Assumes the targeted confirmation labels are centralized in `renderer/src/workout-render.ts` or reachable from it.
- Label updates could miss an edge flow if confirmation text is duplicated across multiple render branches.

## Validation Plan

- Verify workout confirmation dialogs for finish, cancel, and skip actions no longer show generic labels like `Confirm`.
- Manually review label consistency across all workout confirmation points.
- Run `npm --prefix renderer run build` to confirm the renderer still builds successfully.

## Out of Scope

- Changing dialog behavior, safety prompts, or trigger conditions.
- Copy edits outside targeted workout confirmation action labels.

## Handoff Notes for Implementation

- Keep changes limited to user-facing confirmation action wording.
- Preserve existing interaction flow and confirmation safeguards exactly as implemented today.
