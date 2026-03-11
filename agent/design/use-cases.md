# Use Cases

## Purpose

This document describes the system interaction scenarios relevant for the current project state.

It is written for AI agents and human stakeholders.

The focus in this document is the temporary bootstrap use case for the first plan.

The use case is intentionally minimal and exists to verify that:

- renderer
- backend
- database
- API
- container orchestration

work together end to end.

For this bootstrap plan, technical flow details are intentionally included in the use case to validate the full system path.

---

# Current State

The project now includes an initial workout flow and needs explicit behavioural documentation for workout execution and recovery.

---

# Cross-Cutting Product Rule

- All user-facing product copy is written in English.

---

# Target State for Current Plan

A documented workout execution use case exists that covers incremental persistence, reload recovery, completion, and cancellation for the current product slice.

---

## Use Case: Display Hello World

### Goal

Verify the basic interaction between renderer, backend, database, and API.

### Trigger

The user opens the application in the browser.

### Main Flow

1. The renderer loads the application.
2. The renderer requests data from `GET /api/hello-world`.
3. The backend receives the request.
4. The backend reads the first record from the Hello World table in PostgreSQL.
5. The backend returns the value through the API response.
6. The renderer displays the returned value to the user.

### Success Condition

The user sees the Hello World value in the browser, and the value originated from the database through the backend API.

### Constraints

- the database value is read from a table rather than being hardcoded in backend logic
- the backend returns the value through the API
- the renderer displays the value received from the API
- authentication is not part of this plan use case

### Out of Scope for This Plan

- workout execution
- plan management
- authentication
- authorization
- persistent user-specific behaviour
- domain-specific fitness logic

---

## Use Case: Execute and Resume a Workout

### Goal

Allow the user to progress through a workout one exercise at a time, persist progress incrementally after the first confirmed weight entry, resume automatically after a reload, and cancel an unfinished persisted workout.

### Trigger

The user opens the application and starts a workout from the start screen.

### Main Flow

1. The user opens the application and sees the start screen when no active persisted workout exists.
2. The user starts a new workout.
3. The renderer shows the first exercise in the existing workout flow.
4. The user enters a weight for the current exercise and confirms that step.
5. On the first confirmed exercise, the renderer sends the workout state to the backend and the backend creates the persisted workout together with the progress needed to continue it later.
6. Before that first confirmed exercise is submitted, the workout exists only in transient UI state and is not resumable after leaving the page.
7. On each later confirmed exercise, the renderer sends the updated workout state to the backend and the backend updates the persisted workout progress.
8. The renderer advances to the next exercise without changing the overall step-by-step interaction model.
9. If the user reloads or reopens the application while a persisted workout is still unfinished, the application checks for an active workout during startup and routes directly back into that workout instead of the start screen.
10. If invalid duplicate active workouts exist, the application resumes the first active workout and does not expose separate recovery controls in this plan slice.
11. The user continues entering weights until the last exercise is confirmed.
12. The backend marks the workout as completed after the final confirmation and removes it from the resumable active-workout state.
13. The completed workout is no longer resumable or cancellable through the workout UI.
14. The application returns to the non-active state in which the user can start a new workout.

### Cancellation Flow

1. During an unfinished persisted workout, the user can choose to cancel the workout.
2. The UI shows an English confirmation prompt that makes it clear the unfinished workout data will be deleted.
3. If the user confirms cancellation, the backend deletes all persisted records belonging to that unfinished workout.
4. The application returns to the start screen, and the cancelled workout is treated as if it never happened.

### Pre-Persistence Exit Flow

1. The user starts a workout but leaves the flow before confirming the first exercise weight.
2. No workout data has been persisted yet.
3. Returning to the application shows the normal start screen because there is no active persisted workout to resume.

### Success Condition

An unfinished workout survives reloads after the first confirmed exercise, resumes at the correct remaining step, and can be cancelled until it is completed.

### Constraints

- the current exercise-by-exercise workflow remains in place
- weight entry is the only scoped user input for each exercise in this plan slice
- the first persisted write happens only after the first confirmed exercise weight
- leaving the flow before that first confirmed exercise requires no cancellation cleanup because no workout has been persisted yet
- the start screen does not provide a separate resume button
- user-facing copy for this flow is in English
- the automatic resume path, startup recovery, and cancellation confirmation keep that user-facing copy in English
- the system assumes at most one active workout should exist at a time

### Slice Notes

- this `pb-007` slice resumes the first active workout if duplicate unfinished persisted workouts exist
- the workout start, resume, completion, and cancellation flow keeps all user-facing copy in English

### Out of Scope for This Plan

- editing previously submitted exercise entries
- handling invalid multiple-active-workout states beyond choosing the first one if necessary
- preserving unfinished workouts that never reached the first persisted write
- workout history or analytics views
- localization beyond English

---

# Change Notes

- 2026-03-09: Initial bootstrap use case defined for plan 1.
- 2026-03-11: Added the workout execution, incremental persistence, resume, and cancellation use case for plan pb-007 and recorded English-only product copy.
- 2026-03-11: Clarified the transient pre-persistence state and the transition out of the resumable active-workout state on completion.
- 2026-03-11: Clarified that automatic resume and cancellation keep the workout flow copy in English.
