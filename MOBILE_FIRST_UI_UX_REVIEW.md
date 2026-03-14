# Mobile-First UI/UX Review (Current Renderer Workout Flow)

## Purpose and Scope

This document reviews the current renderer experience with a mobile-first lens across the shipped workout flow:

- start screen and workout bootstrap
- active exercise progression with set entry and navigation
- save/error feedback and confirmation dialogs
- completion state

This is research input for a future planning item.
Recommendations in this document are explicitly out of implementation scope for the current plan/item.

## Method and Evidence Base

Observed behavior is grounded in the current renderer implementation:

- `renderer/src/workout-controller.ts`
- `renderer/src/workout-render.ts`
- `renderer/src/styles.scss`

Flow intent was cross-checked against:

- `agent/design/use-cases.md`
- `README.md`

## Quick Flow Snapshot (Mobile)

1. User lands on a compact start screen with plan and gym selectors and one primary start button.
2. Workout screen shows one exercise at a time with read-only completed sets and one editable set.
3. User can adjust load/reps by plus/minus controls or numeric input, then persist with "Complete Set".
4. User can navigate previous/next exercise, finish final exercise, and cancel only after workout persistence exists.
5. Save/error states are shown inline; completion screen confirms success.

## Strengths (Keep)

### 1) Clear one-screen-per-exercise focus supports in-gym usage

- Observable behavior: only one active exercise is shown at once, reducing cognitive load during sets.
- Evidence: `renderExerciseScreen` and `viewState` transitions in `renderer/src/workout-render.ts` and `renderer/src/workout-controller.ts`.

### 2) Read-only history + single editable set prevents accidental retro edits

- Observable behavior: completed sets render as read-only while only the current set remains editable.
- Evidence: set-row rendering mode and `isReadOnly` handling in `renderer/src/workout-render.ts`, `renderer/src/workout-state.ts`, and `renderer/src/workout-controller.ts`.

### 3) Mobile stacking behavior is practical

- Observable behavior: on narrow screens, action buttons and set fields collapse into one-column layouts that stay reachable.
- Evidence: `@media (max-width: 640px)` rules in `renderer/src/styles.scss`.

### 4) Save and error messaging exists at the point of action

- Observable behavior: save status and failure states render directly in the exercise screen while actions are in progress.
- Evidence: `workoutSave` rendering in `renderer/src/workout-render.ts` and save-state transitions in `renderer/src/workout-controller.ts`.

## Findings and Improvement Opportunities (For Future Planning)

### F1) Touch target density is high for frequent controls

- Observable behavior: plus/minus controls use fixed `2.5rem` square targets with tight spacing for both load and reps.
- Mobile risk: repetitive in-session adjustments can suffer from mis-taps and extra correction cycles, especially when fatigued.
- Evidence: `.weight-button` and `.weight-controls` in `renderer/src/styles.scss`.
- Recommendation (future plan): increase target size and spacing for primary in-workout controls, then retest one-handed use.
- Priority: High impact / Low-medium complexity.

### F2) Action hierarchy can create accidental flow jumps

- Observable behavior: on mobile, `.nav-button-primary` is reordered to the first position while next/finish share visual weight with nearby navigation actions.
- Mobile risk: users trying to confirm a set can trigger forward navigation too early when moving quickly.
- Evidence: `.step-actions` and mobile ordering in `renderer/src/styles.scss`; button layout in `renderer/src/workout-render.ts`.
- Recommendation (future plan): strengthen hierarchy between "Complete Set" and navigation actions (visual contrast, placement, and interaction grouping).
- Priority: High impact / Medium complexity.

### F3) Inline numeric input can interrupt fast workout cadence

- Observable behavior: manual editing depends on strict digit-only input; invalid transient input is reverted immediately.
- Mobile risk: while strict validation preserves data quality, immediate reversion can feel abrupt on virtual keyboards and increase friction.
- Evidence: input handler and `isDigitsOnly` behavior in `renderer/src/workout-controller.ts` and `renderer/src/workout-state.ts`.
- Recommendation (future plan): evaluate less disruptive input UX (for example tolerant intermediate states with commit-time normalization).
- Priority: Medium impact / Medium complexity.

### F4) Confirmation dialogs are functional but generic for high-risk actions

- Observable behavior: same dialog shell and generic action labels ("Keep Editing" / "Confirm") are reused for next-exercise, finish, and cancel flows.
- Mobile risk: generic confirmation labels can reduce immediate clarity in fast interactions where users scan quickly.
- Evidence: `renderConfirmDialog` in `renderer/src/workout-render.ts`; call sites in `renderer/src/workout-controller.ts`.
- Recommendation (future plan): use action-specific confirmation labels and stronger semantic emphasis for destructive outcomes.
- Priority: Medium impact / Low complexity.

### F5) Recovery guidance during load/save failures is limited

- Observable behavior: error copy is concise but does not provide explicit next-step guidance beyond retry wording.
- Mobile risk: intermittent gym connectivity can leave users uncertain about whether data was persisted or what to do next.
- Evidence: start and save error strings in `renderer/src/workout-controller.ts` and render surfaces in `renderer/src/workout-render.ts`.
- Recommendation (future plan): add contextual recovery guidance and clearer persistence-state cues in failure scenarios.
- Priority: Medium-high impact / Medium complexity.

## Suggested Follow-Up Backlog Candidates

1. **Mobile control ergonomics pass**: rebalance tap targets/spacing for frequent in-session controls and validate thumb-reach patterns.
2. **Workout action hierarchy pass**: redesign the exercise action area so set confirmation is visually and spatially dominant over navigation.
3. **Input interaction refinement**: reduce abrupt numeric-input rejection while preserving strict persisted value rules.
4. **Contextual confirmation and errors**: make dialogs and failure messages action-specific and recovery-oriented.

## Explicit Scope Boundary

- This document does not implement UI/UX changes.
- It records current-state findings and recommendations only.
- Any changes should be handled in a separate future plan item.
