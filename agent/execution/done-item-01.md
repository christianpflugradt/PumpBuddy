# Replace Native Workout Confirms With App Modals

## Goal

Replace the workout flow's browser-native confirmation popups with app-styled modal dialogs that preserve the existing English confirmation behaviour.

## Scope

- add or adapt a reusable modal interaction pattern in the renderer
- replace the workout cancellation, forward-navigation, and finish confirmation flows that currently use browser-native dialogs
- keep the existing confirmation copy and workout-flow outcomes intact

## Acceptance Criteria

- `renderer/src/app.ts` no longer uses `window.confirm` for workout-flow confirmations
- the renderer presents app-styled confirmation dialogs for cancel, forward-navigation, and finish decisions without changing the existing English user-facing copy
- `npm --prefix renderer test -- --run` passes
- `rg -n "window\\.confirm\\(" renderer/src` returns no matches

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `renderer/src/app.ts`
- `renderer/src/app.test.ts`

## Out of Scope

- broader visual redesign outside the confirmation-dialog behaviour
- introducing a frontend framework or modal dependency that changes the project stack


## Review Acceptance

- Criteria Met: `renderer/src/app.ts` replaces the workout-flow `window.confirm` calls with an app-styled confirmation dialog, keeps the English confirmation copy for cancel, forward navigation, and finish, and the targeted renderer tests cover each modal path.
- Evidence: The modal renderer and dialog actions are implemented in [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L656) and wired into next-exercise, finish, and cancel handlers in [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1203) and [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1365). The previous native-confirm copy is preserved for forward navigation and finish, and the cancel message matches the previous implementation. Coverage for these flows is present in [renderer/src/app.test.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.test.ts#L817) and adjacent tests.
- Runtime/Build Check: `npm --prefix renderer test -- --run` -> passed with 19/19 tests passing; `rg -n "window\\.confirm\\(" renderer/src` -> no matches.
- Residual Risk: none identified
