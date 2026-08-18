# Mobile Workout Guide

## Goal

Make the workout guide comfortable to use on a phone-sized viewport during an active workout.

## Scope

- update the renderer workout screen layout and styling for narrow screens
- keep completed-set history, the editable next set, and the primary progression action readable and reachable without horizontal scrolling
- add or update renderer tests for the mobile workout flow where behavior changes are user-visible

## Acceptance Criteria

- on a phone-sized viewport around `390px` wide, the workout guide keeps the current exercise content readable, avoids horizontal overflow, and leaves the next action reachable without desktop-only spacing assumptions
- the mobile layout still preserves the existing multi-set workout behavior from the documented use case
- `npm --prefix renderer test -- --run` passes

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/test-strategy.md`

## Out of Scope

- start-screen or app-shell layout changes outside the workout guide
- modal layering or backdrop behavior


## Review Acceptance

- Criteria Met: The workout guide now uses a mobile-oriented header and action structure, collapses set rows and actions to single-column layouts on narrow screens, preserves the existing multi-set exercise flow, and the required renderer test command passes.
- Evidence: The committed renderer change reorganizes the exercise screen header and action buttons without changing the underlying set progression controls in [renderer/src/app.ts](renderer/src/app.ts#L721) and [renderer/src/app.ts](renderer/src/app.ts#L758). The responsive CSS removes common overflow sources with `min-width: 0`, stacks set fields and actions for narrow screens, and promotes the primary action on mobile in [renderer/src/styles.css](renderer/src/styles.css#L45) and [renderer/src/styles.css](renderer/src/styles.css#L270). The updated renderer test asserts the revised workout screen structure while continuing through set completion and payload creation in [renderer/src/app.test.ts](renderer/src/app.test.ts#L651).
- Runtime/Build Check: `npm --prefix renderer test -- --run` -> passed with 19 tests, 0 failures on March 12, 2026.
- Residual Risk: No viewport-rendering test exercises an actual `390px` browser width, so the mobile acceptance still relies partly on CSS review rather than a rendered browser assertion.
