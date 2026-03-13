# Plan: Renderer app.ts mixes presentation, API client, state, and workout orchestration

## Item Reference

- Stable item id: `item-12`

## Goal Summary

Refactor the renderer so `renderer/src/app.ts` becomes a thin composition/controller module while API access, workout state shaping, and HTML rendering move into dedicated modules.

## Implementation Approach

- Extract renderer transport types and fetch helpers into an API-focused module, likely covering start-screen loading, active-workout loading, training-plan option requests, and active-workout mutations.
- Move pure workout-plan/state helpers into a separate module, including plan cloning, request payload builders, active-workout response mapping, navigation guards, and small validation utilities.
- Move screen rendering helpers into a dedicated rendering module for the start, exercise, completion, and confirm-dialog markup so `app.ts` stops owning large HTML templates.
- Keep `renderer/src/app.ts` responsible for app bootstrap, local state container setup, render dispatch, and DOM event wiring that coordinates the extracted modules.
- Update imports and shared types so `renderer/src/main.ts` still only boots `createApp`, preserving the thin entrypoint guardrail.

## Risks and Assumptions

- The current tests may rely on exports from `renderer/src/app.ts`, so refactoring should preserve or intentionally re-home those exports without changing tested behavior.
- Event handlers currently mutate the in-memory workout plan directly; extraction should avoid mixing mutable controller code back into pure helper modules.
- This plan assumes no functional workflow changes are needed beyond preserving the current renderer behavior.

## Validation Plan

- Run renderer unit tests, especially `renderer/src/app.test.ts`, and update imports only if structural moves require it.
- Run the renderer build or equivalent type-checking command to catch broken module boundaries and import cycles after the split.
- Sanity-check the startup, in-progress workout, and completion render paths to confirm the controller still selects the correct screen and save-state messaging.

## Out of Scope

- Changing workout behavior, copy, or API contracts.
- Replacing the Web Components/lightweight DOM renderer approach with a framework.
- Broad renderer styling or UX redesign unrelated to the file split.

## Handoff Notes for Implementation

- Preserve the existing public renderer/backend boundary: business rules and persistence authority stay out of the renderer.
- Prefer feature-oriented module names under `renderer/src/` over generic dump files, but keep the layout shallow enough to remain discoverable.
- Treat this as a structural refactor first; add tests only where moves expose untested non-trivial logic or where current coverage breaks during extraction.
