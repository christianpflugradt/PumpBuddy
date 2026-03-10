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
