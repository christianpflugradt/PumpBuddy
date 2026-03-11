# Load Seeded Start Selections In Renderer

## Goal

Adapt the existing workout wizard start screen so the renderer loads seeded training plans and gyms from the backend and uses those selections to begin the workout flow.

## Scope

- replace the current hardcoded single-plan start assumptions with backend-loaded start data
- add minimal renderer state for loading, selection, and start-screen error handling
- keep the existing exercise-step flow as the basis for workout execution after the user starts
- avoid introducing a parallel wizard or heavyweight client-side state architecture

## Acceptance Criteria

- the start screen loads seeded training plans and gyms from backend APIs rather than hardcoded renderer-only combinations
- the user can select a training plan and gym before entering the first exercise step
- existing exercise navigation and weight editing still work after a selection is made
- executable verification: `cd renderer && npm test`

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/design/api-contract.yaml`
- `renderer/src/app.ts`
- `backend/src/main.rs`
- `backend/init.sql`

## Dependencies

- `item-0001`
- `item-0002`

## Out of Scope

- post-workout history views
- full option selection for variants or stations on the renderer
