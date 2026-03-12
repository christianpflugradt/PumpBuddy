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
