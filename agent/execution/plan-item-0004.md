# Plan: Workout Completion State

## Item Reference

- `agent/execution/open-item-0004.md`

## Goal Summary

Add a final static completion state after the fifth exercise so the workout flow ends on a clear `Plan Completed`-style view and no longer falls back to the old Hello World primary UI path.

## Implementation Approach

- Locate the renderer workout flow state machine/navigation logic and add an explicit terminal completion state reached when advancing past the fifth exercise.
- Render a dedicated completion view with static English copy (`Plan Completed` or equivalent) inside the existing Web Components flow.
- Ensure backward navigation behavior remains unchanged for pre-completion steps and does not regress step-to-step navigation before completion.
- Remove or disconnect the previous Hello World page from primary renderer flow so the workout UI is the sole main path.

## Risks and Assumptions

- Assumes item `0003` already provides a five-step exercise progression and navigable step state.
- Risk: off-by-one logic in step advancement could show completion too early or too late.
- Risk: removing Hello World entry flow could unintentionally break local smoke checks if routing/bootstrap still references it.

## Validation Plan

- Run `cd renderer && npm run build`.
- Run `docker compose up --build -d`, then `curl --fail --show-error --silent http://localhost:8080 >/dev/null`, then `docker compose down`.
- Manually verify: progressing beyond the fifth exercise shows completion copy, and backward navigation remains correct before completion.

## Out of Scope

- Backend API integration or persistence for completion state.
- Dynamic copy, localization, or content personalization.
- New authentication/authorization or container topology changes.

## Handoff Notes for Implementation

- Keep completion logic fully client-side and static per item scope.
- Preserve contract-first and stack constraints: Web Components + TypeScript frontend with no heavy framework additions.
- Keep changes minimal and focused on flow/state/render wiring needed for completion behavior.
