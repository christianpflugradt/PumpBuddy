# Use Cases

## Purpose

This document describes the system interaction scenarios relevant for the current project state.

It is written for AI agents and human stakeholders.

The current focus is the workout execution slice, including per-set persistence, default recommendations, reload recovery, completion, and cancellation behaviour.

---

# Current State

The project currently exposes the workout flow only.

The active behaviour is a multi-set workout execution flow that persists completed sets incrementally and resumes unfinished persisted workouts automatically.

---

# Cross-Cutting Product Rule

- All user-facing product copy is written in English.

---

# Target State for Current Plan

A documented workout execution use case exists that matches the shipped multi-set flow, including same-exercise set progression, read-only completed sets, incremental persistence, reload recovery, and cancellation.

---

## Use Case: Execute and Resume a Multi-Set Workout

### Goal

Allow the user to progress through a workout one exercise at a time, complete multiple sets within the same exercise, receive simple default recommendations for the next set, persist completed sets incrementally, resume automatically after a reload, and cancel an unfinished persisted workout.

### Trigger

The user opens the application and starts a workout from the start screen.

### Main Flow

1. The user opens the application and sees the start screen when no persisted unfinished workout exists.
2. The user starts a new workout.
3. The renderer shows the first exercise on a single exercise screen.
4. The screen shows completed sets for the current exercise as read-only history together with an editable suggested next set.
5. For the first set of an exercise, the suggested load and reps come from workout history when available; otherwise the defaults are `10 kg` and `10` reps.
6. The user can adjust the suggested load and reps before confirming the set.
7. After the user confirms a set and remains on the same exercise, that completed set becomes read-only and the next suggested set is prefilled from the immediately previous set.
8. When the workout has not yet reached its first persisted save, the in-progress state exists only in transient renderer state and is not resumable after leaving the page.
9. When the user advances far enough to create the first persisted active workout, the renderer sends the completed sets gathered so far to the backend and the backend creates the `ActiveWorkout`.
10. On each later advancement to another set or to the next exercise, the renderer sends the latest completed-set progress to the backend and the backend updates the persisted active workout incrementally.
11. Earlier completed sets for the current exercise remain visible but non-editable after the user advances to a later set.
12. Earlier exercises also remain non-editable after the user advances beyond them.
13. If the user reloads or reopens the application while a persisted unfinished workout exists, the application checks for an active workout during startup and routes directly back into that workout instead of the start screen.
14. The resumed exercise shows the persisted completed sets as read-only history and an editable suggested next set based on the latest persisted state.
15. If invalid duplicate active workouts exist, the application resumes the first active workout and does not expose separate recovery controls in this slice.
16. The user continues confirming sets and progressing exercise by exercise until the last exercise is complete.
17. On final completion, the backend persists the last completed set, marks the workout as completed, and removes it from the resumable active-workout state.
18. The completed workout is no longer resumable or cancellable through the workout UI.
19. The application returns to the non-active state in which the user can start a new workout.

### Cancellation Flow

1. During an unfinished persisted workout, the user can choose to cancel the workout.
2. The UI shows an English confirmation prompt that makes it clear the unfinished workout data will be deleted.
3. If the user confirms cancellation, the backend deletes all persisted records belonging to that unfinished workout.
4. The application returns to the start screen, and the cancelled workout is treated as if it never happened.

### Pre-Persistence Exit Flow

1. The user starts a workout but leaves the flow before the first persisted save happens.
2. No active workout has been persisted yet.
3. Returning to the application shows the normal start screen because there is no active persisted workout to resume.

### Success Condition

An unfinished workout survives reloads after it reaches persisted active-workout state, completed sets are stored incrementally with their own load and reps, the next set is suggested from history or the immediately previous set, and already completed sets remain read-only after the user advances.

### Constraints

- the workout remains one screen per exercise
- completed sets are persisted as `WorkoutSet`-style per-set data with load and reps rather than as one shared exercise value
- the first set recommendation uses workout history when available and otherwise falls back to `10 kg` and `10` reps
- the next set within the same exercise is prefilled from the immediately previous completed set
- completed sets from the current exercise remain visible but non-editable after advancement
- earlier exercises remain non-editable after the user moves on
- the start screen does not provide a separate resume button
- user-facing copy for this flow is in English
- the automatic resume path and cancellation confirmation keep that user-facing copy in English
- the system assumes at most one active workout should exist at a time

### Slice Notes

- this documentation reflects the active workout-only product surface
- the renderer and backend exchange active-workout progress as completed sets plus the next suggested set for the current exercise
- Hello World is not an active current-state use case in this repository

### Out of Scope for This Plan

- editing previously completed sets after the user has advanced
- handling invalid multiple-active-workout states beyond choosing the first one if necessary
- workout history or analytics views
- automatic recommendation logic beyond reuse of workout history or the immediately previous set
- localization beyond English

---

# Change Notes

- 2026-03-09: Initial bootstrap use case defined for plan 1.
- 2026-03-11: Added the workout execution, incremental persistence, resume, and cancellation use case for plan pb-007 and recorded English-only product copy.
- 2026-03-11: Clarified the transient pre-persistence state and the transition out of the resumable active-workout state on completion.
- 2026-03-11: Clarified that automatic resume and cancellation keep the workout flow copy in English.
- 2026-03-12: Removed the obsolete Hello World bootstrap use case so the document reflects the active workout-only product surface.
- 2026-03-12: Rewrote the workout use case to match the shipped multi-set flow, per-set persistence, read-only completed sets, and default recommendation behaviour.
