# Item 0004 - Workout Completion State

## Goal

Complete the static workout flow by showing a final completion view after the fifth exercise (`Plan Completed` or equivalent).

## Scope

- transition to a dedicated completion state when the final exercise step is completed
- render static completion copy in English (for example `Plan Completed`)
- ensure backward navigation from earlier steps still works before completion is reached
- keep completion behavior fully client-side and static with no backend integration

## Acceptance Criteria

- progressing past the fifth exercise shows a completion view with `Plan Completed` or equivalent English copy
- the renderer no longer exposes the previous Hello World page as an alternative primary UI flow
- `cd renderer && npm run build` exits successfully
- `docker compose up --build -d && curl --fail --show-error --silent http://localhost:8080 >/dev/null && docker compose down` exits successfully

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`

## Dependencies

- `item-0003`


## Review Acceptance

- Criteria Met: Completion view appears after exercise 5 (`viewState` transitions to `screen: "completion"` when `next` is pressed on final step in `renderer/src/main.ts`), completion copy is English (`Plan Completed`), previous navigation is preserved before completion (`previous` decrements step index only when > 0), and renderer primary UI is the workout start/exercise/completion flow rather than Hello World.
- Evidence: `renderer/src/main.ts:24-27` defines explicit completion state; `renderer/src/main.ts:92-99` renders completion copy; `renderer/src/main.ts:149-166` keeps backward navigation and transitions to completion only after final exercise; `renderer/index.html:10-15` and `renderer/src/main.ts:37-43` show the workout start UI.
- Runtime/Build Check: `cd renderer && npm run build` exited 0 (Vite build succeeded). `docker compose up --build -d && curl --fail --show-error --silent http://localhost:8080 >/dev/null && docker compose down` initially failed due startup timing (`curl: (7)`), then succeeded with readiness wait loop and final curl check returning success before clean `docker compose down`.
- Residual Risk: Low; no automated UI assertion verifies the exact "fifth exercise then completion" click path, but implementation and runtime smoke checks are consistent with the requirement.
