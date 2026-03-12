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
