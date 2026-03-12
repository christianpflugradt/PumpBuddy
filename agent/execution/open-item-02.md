# Mobile App Shell Polish

## Goal

Improve narrow-screen usability for the concrete non-workout screens that participate in the workout experience.

## Scope

- refine the renderer start screen and related app-shell layout areas that currently assume desktop width
- remove obvious clipping, overlap, or awkward scrolling on narrow screens without redesigning the app information architecture
- add or update renderer tests only where the changed behavior needs regression coverage

## Acceptance Criteria

- the start screen and affected app-shell areas behave cleanly on a phone-sized viewport around `390px` wide, with no obvious clipping or overlapping controls
- the implementation stays focused on concrete mobile pain points outside the workout guide rather than introducing a broad visual redesign
- `npm --prefix renderer test -- --run` passes

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/test-strategy.md`

## Out of Scope

- workout-guide-specific mobile layout changes
- dialog behavior changes
