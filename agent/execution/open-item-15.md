# Renderer app.ts mixes presentation, API client, state, and workout orchestration

## Summary

The renderer has a single 1,584-line `app.ts` file that combines API DTOs, fetch helpers, state transitions, HTML rendering, persistence orchestration, and DOM event handling, which is the exact layering mix the engineering guardrails say to split before adding more behavior.

## Evidence

- `wc -l` reports [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts) at 1,584 lines.
- The file defines transport models and fetch helpers near [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L56), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L190), and [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L307).
- The same file also renders the UI at [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L535), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L710), and [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L808).
- Workout-flow orchestration and event wiring live in the same module at [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L859), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L973), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1203), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1318), and [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1396).

## Goal

Refactor the renderer into smaller modules that separate API access, workout state/orchestration, and screen rendering so the public layer stays thin and easier to extend safely.

## Scope

- extract API client and transport types out of `renderer/src/app.ts`
- split workout-flow state transitions and persistence orchestration from rendering helpers
- keep the current Web Components or lightweight DOM approach, but reduce the file’s mixed responsibilities

## Acceptance Criteria

- renderer API/client code lives outside the primary UI composition module
- workout state/orchestration logic is separated from pure rendering helpers
- `renderer/src/app.ts` is no longer the default landing place for unrelated workout UI, API, and state changes

## References

- [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts)
- [renderer/src/main.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/main.ts)
- [agent/strategy/engineering-guardrails.md](/Users/cpf/Workspace/personal/PumpBuddy/agent/strategy/engineering-guardrails.md)
