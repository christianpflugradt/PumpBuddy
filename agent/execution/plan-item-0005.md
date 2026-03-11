# Plan: Resume Persisted Workouts on Reload

## Item Reference

- `agent/execution/open-item-0005.md`

## Goal Summary

Resume an unfinished persisted workout during application startup so a reload restores the user to the next in-progress exercise instead of leaving them on the start screen.

## Implementation Approach

- inspect the current renderer startup flow in `renderer/src/app.ts` and identify where initial data loading can also query active workouts without disrupting the no-active-workout path
- add a startup fetch for persisted active workouts and, when one exists, translate the backend response into the renderer workout state, including the current exercise index and visible exercise data
- keep the existing start screen behavior for the empty-state path and avoid introducing any manual resume controls or alternative user flows
- reuse existing workout-building or exercise-mapping helpers where possible so resumed state and newly started state stay structurally aligned
- add or update frontend tests that cover both startup outcomes: no active workout remains on the start screen, and an unfinished persisted workout restores the correct next exercise automatically

## Risks and Assumptions

- the active-workout response may not match the renderer's current in-memory shape directly, so a normalization step will likely be needed
- startup loading may need clearer loading and error handling so resume checks do not create inconsistent intermediate UI states
- if the backend can return multiple active workouts, implementation should follow the item guidance and use the first result without expanding scope into data repair

## Validation Plan

- run `npm test` in `renderer`
- manually verify in tests or mocks that startup with no active workout still renders the normal start screen
- manually verify in tests or mocks that startup with an unfinished active workout lands on the correct next exercise without showing a separate resume prompt

## Out of Scope

- adding a manual resume action to the start screen
- repairing invalid multiple-active-workout records beyond selecting the first backend result
- changing backend contract scope unless the current contract is insufficient for the accepted resume behavior

## Handoff Notes for Implementation

- preserve the existing start screen as the default fallback when no resumable workout exists
- treat persisted backend workout progress as authoritative when reconstructing the current exercise position
- keep frontend tests focused on observable startup behavior rather than internal implementation details
