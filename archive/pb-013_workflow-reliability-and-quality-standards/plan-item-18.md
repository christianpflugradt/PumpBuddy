# Plan: Renderer app.ts remains a mixed-responsibility monolith

## Item Reference

- `agent/execution/open-item-18.md`

## Goal Summary

Refactor the renderer so API client/transport types and workout state/orchestration logic live outside `renderer/src/app.ts`, leaving the entrypoint focused on wiring and rendering composition.

## Implementation Approach

- audit `renderer/src/app.ts` to identify API client/transport DTO definitions, workout state transitions, persistence orchestration, and rendering helpers
- extract transport types and API client helpers into dedicated modules under `renderer/src/` (or an existing renderer subdirectory) and update imports
- extract workout state transition and persistence orchestration logic into a focused module, keeping pure rendering helpers separate
- slim down `renderer/src/app.ts` to bootstrap UI, wire dependencies, and compose rendering/state modules
- update any affected tests (`renderer/src/app.test.ts`) to target the new modules and preserve coverage of key behaviour

## Risks and Assumptions

- assume current renderer module structure allows new files without breaking bundling or test configuration
- risk of subtle behaviour changes when moving state orchestration; must preserve current workflow order

## Validation Plan

- run renderer unit tests (Vitest) if available
- sanity-check the renderer build or lint step if it exists

## Out of Scope

- changing workout behaviour or UI copy
- introducing new frameworks or dependencies

## Handoff Notes for Implementation

- keep renderer entrypoints thin per `agent/strategy/engineering-guardrails.md`
- avoid introducing new dependencies; stick to the current TypeScript/Web Components/Vite stack
