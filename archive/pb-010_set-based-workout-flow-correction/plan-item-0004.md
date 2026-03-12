# Plan: Preserve Exercise State Across Navigation

## Item Reference

- `agent/execution/open-item-0004.md`

## Goal Summary

Keep each exercise's local workout state stable while moving backward and forward so the active exercise restores its completed rows plus its in-progress draft row, and previously left exercises remain visible but read-only.

## Implementation Approach

- extend the renderer workout-plan state in `renderer/src/app.ts` so each exercise retains enough local navigation metadata to distinguish the current editable exercise from previously left exercises without promoting draft values into persisted history
- update the exercise navigation handlers to change only view state when moving between exercises, preserving each exercise's `completedSets` and `activeSet` exactly as last seen instead of rebuilding them from suggested defaults
- adjust exercise rendering so the active exercise continues to show one editable draft row, while revisited earlier exercises render their restored rows in read-only form with no editing controls
- keep active-workout payload builders limited to confirmed `completedSets` so navigation alone never writes draft state to the backend or turns a local draft into persisted progress
- add or update `renderer/src/app.test.ts` coverage for backward and forward revisits, restored current-exercise draft values, and read-only rendering for previously left exercises

## Risks and Assumptions

- the current `ExerciseStep` model only tracks `suggestedSet`, `activeSet`, and `completedSets`, so preserving read-only versus editable behaviour will likely require a small local-state extension rather than only render-time conditionals
- `applyActiveWorkoutResponse` and related rebuild helpers may currently reseed `activeSet` from persisted suggestions, so the implementation needs to avoid clobbering a locally preserved draft when navigation happens without a save
- this item is assumed to stay renderer-local; if resumed active-workout responses need extra metadata to preserve editability semantics, that would be a follow-up beyond the current scope

## Validation Plan

- run `npm --prefix frontend test -- --run`
- verify tests cover revisiting the current in-progress exercise and restoring its last local `activeSet` values rather than recomputed defaults
- verify tests or assertions confirm earlier exercises render without editable controls after the user has moved past them

## Out of Scope

- changing backend contracts or persisting unconfirmed draft rows during navigation
- redefining confirmation rules from item `0003` or changing workout completion behaviour

## Handoff Notes for Implementation

- prefer a small explicit local-state flag or per-exercise navigation status over deriving read-only behaviour indirectly from index math alone
- keep the distinction clear between locally preserved draft state and server-persisted completed set history
