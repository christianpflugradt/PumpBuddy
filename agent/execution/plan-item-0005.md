# Plan: Load Seeded Start Selections In Renderer

## Item Reference

- `agent/execution/open-item-0005.md`

## Goal Summary

Replace the renderer's hardcoded single-plan start flow with backend-loaded training plan and gym selections, while keeping the existing exercise-step navigation and weight editing flow intact after workout start.

## Implementation Approach

- add a small renderer bootstrap layer in `renderer/src/app.ts` that fetches `/api/training-plans` and `/api/gyms`, tracks loading and fetch failure state, and stores the selected training plan and gym before workout start
- update the start screen markup and click/input handling so the user can choose a plan and gym, cannot start until both are available, and sees a lightweight loading or error state without introducing a separate client-side state system
- derive the exercise flow from the selected backend plan data so the existing exercise screen, next/previous navigation, and weight editing continue to work once the workout begins
- add or update renderer tests around initial loading, selection/start behavior, and regression coverage for the exercise-step interactions after a backend-seeded selection

## Risks and Assumptions

- the current `/api/training-plans` response only exposes plan summaries, so implementation may need to pair that with existing option data or another already-available source to build exercise steps without expanding item scope
- async bootstrap introduces a new renderer failure mode; the UI should surface a bounded start-screen error instead of falling back to stale hardcoded data
- seeded backend data is assumed to be present in local development and tests

## Validation Plan

- run `cd renderer && npm test`
- manually verify the start screen loads backend plans and gyms, blocks invalid starts, and preserves exercise navigation plus weight editing after a valid selection

## Out of Scope

- post-workout history views
- full renderer-side selection flows for variants or stations beyond the scoped start selections
- introducing a new heavyweight state-management pattern or parallel wizard flow

## Handoff Notes for Implementation

- keep the renderer aligned with the OpenAPI contract and existing lightweight Web Components/Vite approach
- prefer minimal new state and keep workout execution behavior in the current `app.ts` flow unless a small extraction is needed for testability
