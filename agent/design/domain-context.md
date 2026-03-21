# Domain Context

## Purpose

This document captures the human-readable product context for the training domain.

Use this file for meaning and intent.
Use the structured models for entity and persistence details.

---

## Domain Goals

- represent reusable training plans
- preserve historical correctness even when plans evolve
- generate workout instances from plans
- track performed loads for progression
- support exercise variants
- support gym-specific and station-specific load behavior
- support free workout execution without gym setup
- support mixed units (`kg`, `lbs`) and discrete load steps
- support one active resumable workout at a time for the current product slice

---

## Core Principles

- Workouts keep the exact plan context they started with.
- Changing a training plan creates a new plan version, not a rewrite of history.
- Plan versions are immutable once published.
- Historically relevant blueprint data is archived instead of physically deleted.
- Active workout continuity remains a core product guarantee.

---

## Core Flow

1. A `TrainingPlan` provides a stable plan identity.
2. A `TrainingPlanVersion` defines the ordered exercises for one concrete plan state.
3. A `Workout` is instantiated from one `TrainingPlanVersion`.
4. A workout runs in one mode: `configured_gym` or `free`.
5. In `configured_gym`, each planned exercise uses ordered allowed options for the selected gym.
6. In `free`, exercises are executed without gym-specific variant or station resolution.
7. During execution, performed sets are stored as `WorkoutSet` records with selected load.
8. Progression logic uses historical `WorkoutSet` data where context quality is sufficient.

---

## Domain Rules

- Past workouts stay readable and trustworthy even after plan changes.
- Any plan change that would alter workout meaning creates a new `TrainingPlanVersion`.
- New workouts start from the latest eligible plan version; existing workouts keep their original version.
- Published blueprint versions that can affect history are never physically deleted.
- Each plan exercise defines an ordered list of allowed options.
- In `configured_gym`, a selected gym is required and each plan exercise must have at least one realizable option before workout start.
- In `configured_gym`, if any plan exercise has no realizable option in the selected gym, workout start is blocked with a clear domain error.
- In `free`, no gym is required and variant/station fields stay unresolved.
- Progression suggestions for gym-aware recommendations exclude `free` workouts by default.
- Cancelling an unfinished workout removes only the unfinished workout data, not blueprint history.

---

## Ubiquitous Language

- `TrainingPlan`: stable plan identity that groups all versions of one plan.
- `TrainingPlanVersion`: immutable snapshot of a plan that is used to start workouts.
- `Workout`: concrete execution instance of a plan.
- `WorkoutMode`: execution context of a workout (`configured_gym` or `free`).
- `ActiveWorkout`: an unfinished persisted `Workout` that the application should resume automatically on application startup.
- `Exercise`: canonical movement definition (for example: Butterfly).
- `ExerciseVariant`: concrete way to perform an exercise (cable seated, cable standing, machine, dumbbell incline).
- `Gym`: real-world fitness center.
- `EquipmentStation`: concrete station in a gym (for example left cable tower, chest fly machine #2).
- `LoadProfile`: allowed load steps for a station or equipment class, including display unit.
- `WorkoutSet`: performed set with selected load and reps.

---

## Compatibility Notes

- `ExerciseVariantEquipmentCompatibility` defines which stations can technically realize a variant.
- `TrainingPlanExerciseOption` defines which options are offered for a specific plan exercise in a specific gym.
- `selection_order` gives deterministic ordering of allowed options.
- In `configured_gym`, workout start requires at least one realizable option for every exercise in the selected gym.

---

## Deferred

- renderer integration of real domain data
- full progression algorithm behavior
- variant rotation and variation-pool behavior across completed workouts
- strict UI enforcement strategy for pre-start validation timing and messaging
- authentication, authorization, and multi-user ownership enforcement
- advanced station equivalence and transfer-learning rules

---

## Open Decisions

- whether `WorkoutSet` should also store per-side load for unilateral exercises
- whether station equivalence should be explicit in schema (`equipment_station_group`) in pb-004
- whether warm-up sets are separate records or flagged `WorkoutSet` entries
- whether option selection should always be user-driven or can auto-suggest top-ranked available options
