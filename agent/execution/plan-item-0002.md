# Plan: Complete Sets Without Exercise Navigation

## Item Reference

- `agent/execution/open-item-0002.md`

## Goal Summary

Update the active workout flow so confirming a set completes only the current set on the current exercise, persists that completed set immediately, and leaves the user on the same exercise with a new draft row suggested from the completed values.

## Implementation Approach

- inspect the current active-workout flow to identify where the existing set action advances exercise state instead of only completing the current set
- split the completion flow so persisting a confirmed set and preparing the next draft row are treated as separate steps, with only the completed set written immediately
- update the UI state handling so the current exercise keeps its completed rows and appends a fresh editable draft row seeded from the just-completed set
- adjust or add tests around active workout behaviour to cover same-exercise completion, immediate persistence of the completed row, and the unpersisted follow-up draft row

## Risks and Assumptions

- the current implementation may couple set confirmation with broader exercise navigation, so the change may require touching both frontend state management and backend request handling
- suggested values for the next draft row are assumed to come directly from the most recently completed set unless existing domain rules define a different derivation

## Validation Plan

- run targeted active-workout tests covering set completion and persistence behaviour
- run `cargo test active_workout`

## Out of Scope

- changing overall workout navigation rules outside the faulty set completion path
- changing item acceptance criteria or introducing new workout progression behaviour

## Handoff Notes for Implementation

- keep the change implementation-oriented and scoped to the active exercise set-completion regression
- preserve the distinction between persisted completed sets and the next editable draft row
