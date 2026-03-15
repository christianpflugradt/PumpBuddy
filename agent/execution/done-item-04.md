# Recenter Exercise View on Current Set

## Goal

Refocus exercise-screen information hierarchy so the current set interaction is the primary visual and task anchor.

## Scope

- restructure exercise-screen content order to emphasize current set context before historical content
- present set index, weight controls, reps controls, and completion action in a clear primary flow
- keep completed history accessible but subordinate below the active interaction area

## Acceptance Criteria

- exercise view presents current set details and controls in a single, clearly prioritized interaction block
- completed set history appears beneath the active set interaction block and does not compete with it visually
- running `npm --prefix renderer run test` succeeds with the updated exercise hierarchy

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/workout-render.ts`
- `renderer/src/styles.scss`

## Dependencies

- `item-03`

## Notes for Review

- validate recommendation 4 from `MOBILE_FIRST_UI_UX_REVIEW.md` by checking that users can identify the next action without scanning secondary content first


## Review Acceptance

- Criteria Met: Exercise screen renders a single prioritized current-set interaction block (set index, editable load/reps controls, and complete action), completed history is subordinate below that block, and renderer tests pass.
- Evidence: `renderer/src/workout-render.ts` renders `set-list` with current set heading/counter, editable controls via `renderSetRow(...)`, and `Complete Set` before conditionally rendering `completed-set-list` history section; `renderer/src/styles.scss` further de-emphasizes history with compact row styling under a divider.
- Runtime/Build Check: Executed `npm --prefix renderer run test` and observed `# pass 25`, `# fail 0`, command exit success.
- Residual Risk: none identified.
