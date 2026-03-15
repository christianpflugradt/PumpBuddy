# Improve Start Screen Motivation Cues

## Goal

Make the workout start screen more motivating by adding workout preview and contextual cues without slowing the start flow.

## Scope

- add a concise upcoming workout preview section on the start screen
- introduce subtle contextual cues (for example training plan and location indicators) aligned with existing design language
- preserve existing start action prominence and workflow timing

## Acceptance Criteria

- start screen presents a readable workout preview before the user begins the session
- contextual cues are visible and support orientation without crowding the primary start action
- running `npm --prefix renderer run build` succeeds after start screen updates

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/workout-render.ts`
- `renderer/src/styles.scss`

## Dependencies

- `item-05`

## Notes for Review

- validate recommendation 10 from `MOBILE_FIRST_UI_UX_REVIEW.md`


## Review Acceptance

- Criteria Met: Start screen now shows a readable workout preview before session start, contextual training plan/location cues are visible without displacing the primary start action, and the renderer build succeeds.
- Evidence: `renderer/src/workout-render.ts` adds `renderStartPreview()` with a titled preview section and two contextual cue rows for selected plan and gym, and `renderStartScreen()` places it after the selectors while preserving the full-width `Start Workout` button. `renderer/src/styles.scss` adds compact `.start-preview*` styling that keeps the panel scannable and subordinate to the primary action.
- Runtime/Build Check: Executed `npm --prefix renderer run build` and observed `vite build` complete successfully with `✓ built in 639ms`.
- Residual Risk: none identified.
