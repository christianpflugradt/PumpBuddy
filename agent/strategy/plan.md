# Plan: Command Language Alignment and Remaining Mobile UI/UX Review Delivery

## Plan ID

pb-016

## Goal

Align developer-facing command names with product-oriented language and complete the remaining prioritized mobile UI/UX recommendations so the workout experience is clearer, safer, and faster on mobile.

## Scope

- rename Makefile targets to business-oriented names where appropriate, keeping `check` unchanged
- add a new Makefile stop command mapped to Docker Compose stop behavior as `stop-app`
- apply agreed Makefile naming: `run-app`, `stop-app`, `rebuild-app`, `setup-dev`, `refresh-api-clients`, `refresh-backend-api-client`, `refresh-frontend-api-client`, with `check` retained
- implement `MOBILE_FIRST_UI_UX_REVIEW.md` recommendations `6` through `12` in strict source order
- keep implementation grounded in `MOBILE_FIRST_UI_UX_REVIEW.md` details so recommendation intent is preserved during execution

## Out of Scope

- reworking or re-implementing already delivered mobile UI/UX recommendations `1` through `5`, unless a direct dependency is discovered during implementation
- introducing additional mobile UI/UX improvements beyond recommendations `6` through `12`
- keeping backward-compatible aliases for renamed Makefile commands
- changing commit scope governance or PWA baseline work addressed in earlier plans

## Success Criteria

- Makefile exposes the agreed command names exactly, including new `stop-app`, and retains `check` unchanged
- old renamed Makefile command names are removed (no compatibility aliases)
- mobile UI/UX recommendations `6`, `7`, `8`, `9`, `10`, `11`, and `12` are implemented and traceable in execution items
- UI recommendation implementation order in execution items follows source priority order (`6` to `12`)

## Constraints

- keep this plan to a practical refinement size target of 4-8 execution items (expected: 8)
- preserve existing architecture boundaries (renderer/backend/database) while implementing changes
- prefer low-risk iterative UX improvements that do not regress core workout logging flow

## Inputs

- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `Makefile`
- `archive/pb-015_mobile-ux-foundation-pwa-baseline-and-commit-scope-governance/plan.md`
- `agent/strategy/plan.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
