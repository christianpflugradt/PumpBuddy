# Split Renderer Interaction and Persistence Coordination

## Goal

Move workout UI event routing and API persistence coordination out of `workout-controller.ts` into dedicated modules with explicit boundaries.

## Scope

- extract DOM listener registration and event routing into a focused interaction module
- extract workout persistence coordination (API call sequencing and save/retry coordination) into a focused persistence module
- compose the extracted modules through explicit interfaces from the controller wiring layer
- preserve current user-visible workout interaction behavior

## Acceptance Criteria

- dedicated interaction and persistence modules exist and are wired through explicit interfaces
- `renderer/src/workout-controller.ts` no longer directly owns the full event matrix and persistence coordination logic
- workout interactions and save lifecycle behavior remain unchanged for start, save, resume, complete, and cancel flows
- executable verification: `npm --prefix renderer test`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `renderer/src/workout-controller.ts`
- `renderer/src/workout-render.ts`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-02`

## Out of Scope

- introducing new API endpoints
- changing product copy or localization behavior
