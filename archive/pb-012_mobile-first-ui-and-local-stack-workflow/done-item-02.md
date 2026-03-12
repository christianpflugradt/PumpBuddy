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


## Review Acceptance

- Criteria Met: The renderer start screen and adjacent shell screens now share a narrow-width `screen-panel` layout, mobile-specific stacking rules remove obvious overlap/clipping at phone widths, the change remains limited to concrete renderer shell markup/CSS, and `npm --prefix renderer test -- --run` passes.
- Evidence: `renderer/src/app.ts` moves the start, exercise, and completion screens into a shared `screen-panel`/`app-header` structure with grouped `start-fields`; `renderer/src/styles.css` adds constrained panel sizing, full-width controls, and a `@media (max-width: 640px)` layout that reduces panel padding and stacks set rows and action buttons into single-column mobile layouts; `renderer/src/app.test.ts` adds coverage that the start screen renders inside the new mobile shell panel.
- Runtime/Build Check: `npm --prefix renderer test -- --run` -> passed with 20 tests passing, 0 failing.
- Residual Risk: No browser-rendered viewport assertion covers an actual `390px` width, so final mobile fit still relies partly on CSS review.
