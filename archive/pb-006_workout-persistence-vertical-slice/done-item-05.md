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

- `item-01`
- `item-02`

## Out of Scope

- post-workout history views
- full option selection for variants or stations on the renderer


## Review Acceptance

- Criteria Met: The start screen now loads training plans and gyms from backend APIs, requires both selections before starting, and uses the selected plan and gym to fetch exercise options before entering the existing exercise-step flow; weight editing and exercise navigation remain intact after start.
- Evidence: `renderer/src/app.ts` loads `/api/training-plans` and `/api/gyms` via `loadStartScreenData`, stores loading/error/selection state, and on start fetches `/api/training-plans/{id}/options?gymId=...` before switching to the exercise screen. `backend/src/main.rs` exposes `/api/gyms`, `/api/training-plans`, and `/api/training-plans/{training_plan_id}/options`, and `backend/init.sql` seeds multiple gyms and training plans that satisfy the renderer selection flow.
- Runtime/Build Check: `cd renderer && npm test` -> passed; 6 tests passed, 0 failed.
- Residual Risk: Renderer tests cover the state helpers and plan-building logic, but there is not yet an end-to-end browser test covering DOM interaction across the full start-to-exercise transition.
