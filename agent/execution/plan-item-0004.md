# Plan: Persist Workout Progress From the Existing Flow

## Item Reference

- `agent/execution/open-item-0004.md`

## Goal Summary

Keep the existing exercise-by-exercise workout flow intact while persisting the active workout only after the first confirmed weight entry, then sending incremental updates on later confirmations.

## Implementation Approach

- inspect the current renderer workout state flow in `renderer/src/app.ts` and identify where exercise confirmation currently advances the UI
- add a frontend-side distinction between an unpersisted in-progress workout and a persisted active workout so the first confirmation triggers the create call and later confirmations trigger update calls
- map backend active workout responses back into renderer state after each successful persistence call so the next exercise step uses server-aligned progress
- keep the start screen behavior unchanged by avoiding any eager persistence or resume affordance in the normal path
- add or update frontend tests around the first confirmation and subsequent confirmations to verify request sequencing and state advancement

## Risks and Assumptions

- the current renderer state model may need a small refactor to track whether an active workout id or equivalent persisted marker exists
- backend responses may contain authoritative progress fields that require careful normalization before re-rendering the next step
- tests should assert behavior at the request and UI-flow level without over-coupling to internal implementation details

## Validation Plan

- run `npm test` in `renderer`
- run `npm run lint` in `renderer`
- manually verify in tests or mocks that no persistence request occurs before the first confirmed weight, then create happens once and later confirmations use update semantics

## Out of Scope

- automatic reload recovery
- workout cancellation UI
- changing the workout start screen to add resume or recovery controls

## Handoff Notes for Implementation

- preserve the current one-exercise-at-a-time interaction model
- treat the backend response as the source of truth after each confirmation where persisted progress is involved
- avoid expanding scope into backend contract changes unless the existing contract blocks the accepted behavior
