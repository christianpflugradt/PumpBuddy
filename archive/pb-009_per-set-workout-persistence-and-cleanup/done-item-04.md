# Update Workout Use-Case Documentation

## Goal

Document the current workout behaviour so the use-case description matches the shipped multi-set flow and no longer treats Hello World as an active use case.

## Scope

- rewrite `agent/design/use-cases.md` to describe the current workout execution flow with per-set persistence, same-exercise set progression, read-only completed sets, and default recommendation behaviour
- remove or archive the active Hello World use-case description from the current-state documentation
- keep the documented user-facing copy assumptions aligned with the plan and English-only product rule

## Acceptance Criteria

- `agent/design/use-cases.md` describes multi-set workout execution, incremental persistence on set progression, and the non-editable status of earlier completed sets after advancement
- `agent/design/use-cases.md` no longer presents Hello World as an active current-state use case
- `sed -n '1,260p' agent/design/use-cases.md` shows the updated workout-only use-case content and no active Hello World use case

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `agent/design/api-contract.yaml`

## Dependencies

- `item-02`
- `item-03`

## Notes for Review

- Review should check that the document matches the implemented flow and does not drift back to the bootstrap terminology.


## Review Findings

### Criterion

`agent/design/use-cases.md` describes multi-set workout execution, incremental persistence on set progression, and the non-editable status of earlier completed sets after advancement

- Status: fail
- Evidence: `git show HEAD:agent/design/use-cases.md | sed -n '1,220p'` still shows the older "Execute and Resume a Workout" flow centered on confirming one weight per exercise. Its main flow says "The user enters a weight for the current exercise and confirms that step" and "On each later confirmed exercise" rather than documenting same-exercise set progression, first-set recommendations, or read-only completed sets. The shipped renderer/backend behavior already supports those details via `renderer/src/app.ts`, `renderer/src/app.test.ts`, and the active-workout contract/domain docs.
- Risk: Accepting this item would leave the canonical current-state use-case document out of sync with the shipped multi-set workflow, which undermines later planning and review work that relies on `agent/design/use-cases.md` as the current behavioral reference.

### Criterion

`sed -n '1,260p' agent/design/use-cases.md` shows the updated workout-only use-case content and no active Hello World use case

- Status: fail
- Evidence: The committed file state reviewed for this item is still the pre-update document. `git show HEAD:agent/design/use-cases.md | sed -n '1,220p'` shows the workout-only surface and no active Hello World use case, but it does not show the required updated multi-set content for this item. The worktree contains an uncommitted rewrite, yet the review instructions require evaluating the committed implementation that moved the item into review.
- Risk: The item would be marked accepted without a committed implementation satisfying the documented validation command, breaking the task workflow and allowing an unreviewed worktree edit to stand in for an accepted committed change.


## Review Acceptance

- Criteria Met: `agent/design/use-cases.md` now documents the shipped multi-set workout flow, including same-exercise set progression, incremental per-set persistence, read-only completed sets after advancement, default first-set recommendations, and removal of Hello World as an active current-state use case.
- Evidence: [agent/design/use-cases.md](agent/design/use-cases.md#L9) states the current focus includes per-set persistence and default recommendations; [agent/design/use-cases.md](agent/design/use-cases.md#L33) through [agent/design/use-cases.md](agent/design/use-cases.md#L99) describes the multi-set execution flow, incremental `ActiveWorkout` persistence, and read-only completed-set behavior; [renderer/src/app.test.ts](renderer/src/app.test.ts#L392) and [renderer/src/app.test.ts](renderer/src/app.test.ts#L625) cover same-exercise persistence and resumed read-only history behavior reflected by the updated documentation.
- Runtime/Build Check: `npm test -- --test-name-pattern='createApp persists sets within the same exercise, advances exercises, and completes|createApp resumes a persisted workout with read-only history and a suggested next set'` in `renderer` passed with `13` tests passed, `0` failed.
- Residual Risk: none identified
