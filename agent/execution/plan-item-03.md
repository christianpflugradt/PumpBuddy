# Plan: Improve Workout Error Recovery Guidance

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Update workout error messaging so users know whether progress is safe and what recovery or sync behavior to expect during temporary connectivity issues.

## Implementation Approach

- Identify workout-flow error and connectivity message strings used when network disruption is surfaced in `renderer/src/workout-render.ts`.
- Update those messages to explicitly state progress safety (saved locally or pending) and the next step (automatic sync or retry guidance) without changing existing retry/sync control flow.
- Keep wording consistent across all affected workout disruption states so the guidance is predictable and action-oriented.

## Risks and Assumptions

- Assumes connectivity-related user-facing messages are centralized in `renderer/src/workout-render.ts` or its direct helpers.
- Message-only changes could still introduce inconsistency if similar fallback text exists outside the primary workout disruption path.

## Validation Plan

- Manually verify the active workout network-disruption path communicates both progress safety status and expected sync/recovery behavior.
- Confirm recommendation 7 from `MOBILE_FIRST_UI_UX_REVIEW.md` is reflected in the updated wording.
- Run `npm --prefix renderer run test`.

## Out of Scope

- Any changes to retry logic, sync scheduling, local persistence behavior, or error handling control flow.
- Copy edits unrelated to workout connectivity and recovery messaging.

## Handoff Notes for Implementation

- Keep the change limited to user-facing message content needed for accuracy and recovery guidance.
- Preserve existing workout error handling and connectivity recovery mechanics exactly as currently implemented.
