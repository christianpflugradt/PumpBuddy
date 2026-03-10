# Item 0001 - Renderer Workout Start Screen Baseline

## Goal

Replace the renderer Hello World page with a static workout start screen that exposes one hardcoded English workout action (`Start Workout`, `Push Day`).

## Scope

- remove renderer UI dependency on the Hello World display flow
- add a renderer start view that shows the workout label `Push Day`
- add a single action control labeled `Start Workout` as the entrypoint to the workout flow
- keep all start-screen data static in renderer code

## Acceptance Criteria

- loading the renderer shows `Push Day` and `Start Workout` instead of the previous Hello World text flow
- no renderer network request to `/api/hello-world` is required for the start screen to render
- `cd renderer && npm run build` exits successfully

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

## Dependencies

- none
