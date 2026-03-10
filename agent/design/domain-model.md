# Domain Model

## Purpose

This document defines the target product domain model for training plans, workout execution, and load tracking.

The model is written in English domain terms and is intended as a stable reference for upcoming plans.

---

## Domain Goals

- represent reusable training plans
- generate workout instances from plans
- track performed loads for progression
- support exercise variants
- support gym-specific and station-specific load behavior
- support mixed units (`kg`, `lbs`) and discrete load steps

---

## Core Flow

1. A `TrainingPlan` defines ordered plan exercises.
2. A `Workout` is instantiated from one `TrainingPlan`.
3. For each planned exercise, the workout captures the selected `ExerciseVariant` and optionally a concrete `EquipmentStation`.
4. During execution, performed sets are stored as `WorkoutSet` records with selected load.
5. Progression logic uses historical `WorkoutSet` data to suggest future loads.

---

## Ubiquitous Language

- `TrainingPlan`: reusable plan template.
- `Workout`: concrete execution instance of a plan.
- `Exercise`: canonical movement definition (for example: Butterfly).
- `ExerciseVariant`: concrete way to perform an exercise (cable seated, cable standing, machine, dumbbell incline).
- `Gym`: real-world fitness center.
- `EquipmentStation`: concrete station in a gym (for example left cable tower, chest fly machine #2).
- `LoadProfile`: allowed load steps for a station or equipment class, including display unit.
- `WorkoutSet`: performed set with selected load and reps.

---

## Entities

### TrainingPlan

Attributes:

- `id` (UUID)
- `name` (string)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- one-to-many with `TrainingPlanExercise`

### TrainingPlanExercise

Attributes:

- `id` (UUID)
- `training_plan_id` (FK)
- `exercise_id` (FK)
- `position` (int, 1..n in plan order)
- `target_sets` (optional int)
- `target_reps_min` (optional int)
- `target_reps_max` (optional int)

Relationships:

- many-to-one to `TrainingPlan`
- many-to-one to `Exercise`

### Exercise

Attributes:

- `id` (UUID)
- `name` (string, unique)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- one-to-many with `ExerciseVariant`
- one-to-many with `TrainingPlanExercise`

### ExerciseVariant

Attributes:

- `id` (UUID)
- `exercise_id` (FK)
- `name` (string)
- `variant_type` (enum-like string, for example `cable`, `machine`, `dumbbell`)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- many-to-one to `Exercise`
- one-to-many to `ExerciseVariantEquipmentCompatibility`

### ExerciseVariantEquipmentCompatibility

Attributes:

- `id` (UUID)
- `exercise_variant_id` (FK)
- `equipment_station_id` (FK)
- `is_enabled` (boolean, default true)
- `created_at` (timestamp)

Relationships:

- many-to-one to `ExerciseVariant`
- many-to-one to `EquipmentStation`

Constraints:

- (`exercise_variant_id`, `equipment_station_id`) unique

### Gym

Attributes:

- `id` (UUID)
- `name` (string)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- one-to-many with `EquipmentStation`
- one-to-many with `Workout`

### EquipmentStation

Attributes:

- `id` (UUID)
- `gym_id` (FK)
- `name` (string)
- `load_profile_id` (FK)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- many-to-one to `Gym`
- many-to-one to `LoadProfile`

### LoadProfile

Attributes:

- `id` (UUID)
- `name` (string)
- `display_unit` (`kg` | `lbs`)
- `canonical_unit` (fixed `kg` internally)
- `min_display_load` (optional decimal)
- `max_display_load` (optional decimal)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- one-to-many with `LoadStep`
- one-to-many with `EquipmentStation`

Notes:

- explicit `LoadStep` values are used instead of only increment size, because real equipment often has non-uniform steps.

### LoadStep

Attributes:

- `id` (UUID)
- `load_profile_id` (FK)
- `position` (int)
- `display_value` (decimal)
- `canonical_value_kg` (decimal)

Relationships:

- many-to-one to `LoadProfile`

Constraints:

- (`load_profile_id`, `display_value`) unique
- (`load_profile_id`, `position`) unique

### Workout

Attributes:

- `id` (UUID)
- `training_plan_id` (FK)
- `gym_id` (FK)
- `started_at` (optional timestamp)
- `completed_at` (optional timestamp)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- many-to-one to `TrainingPlan`
- many-to-one to `Gym`
- one-to-many with `WorkoutExercise`

### WorkoutExercise

Attributes:

- `id` (UUID)
- `workout_id` (FK)
- `training_plan_exercise_id` (FK)
- `position` (int)
- `selected_variant_id` (optional FK)
- `selected_station_id` (optional FK)
- `selected_plan_exercise_option_id` (optional FK)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- many-to-one to `Workout`
- many-to-one to `TrainingPlanExercise`
- optional many-to-one to `ExerciseVariant`
- optional many-to-one to `EquipmentStation`
- optional many-to-one to `PlanExerciseOption`
- one-to-many with `WorkoutSet`

### PlanExerciseOption

Attributes:

- `id` (UUID)
- `training_plan_exercise_id` (FK)
- `gym_id` (FK)
- `exercise_variant_id` (FK)
- `equipment_station_id` (FK)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Relationships:

- many-to-one to `TrainingPlanExercise`
- many-to-one to `Gym`
- many-to-one to `ExerciseVariant`
- many-to-one to `EquipmentStation`

Constraints:

- (`training_plan_exercise_id`, `gym_id`, `exercise_variant_id`, `equipment_station_id`) unique

### WorkoutSet

Attributes:

- `id` (UUID)
- `workout_exercise_id` (FK)
- `set_index` (int, 1..n)
- `reps` (optional int)
- `load_display_value` (decimal)
- `load_display_unit` (`kg` | `lbs`)
- `load_canonical_kg` (decimal)
- `completed_at` (timestamp)
- `created_at` (timestamp)

Relationships:

- many-to-one to `WorkoutExercise`

---

## Compatibility Model

To support variant and station constraints:

- `ExerciseVariantEquipmentCompatibility` defines which stations can technically realize a variant.
- `PlanExerciseOption` defines which options are actually offered for a specific plan exercise in a specific gym.
- Workout start flow uses `(training_plan_exercise_id, gym_id)` to load offered options.
- This supports your scenario where `Butterfly` in Gym A offers exactly:
  - dual cable station option
  - V-cable station option
  - machine station option
- Progression should preferably use historical data with same `selected_variant_id` and same or equivalent `selected_station_id`.

---

## Domain Invariants

- `TrainingPlanExercise.position` is unique within one plan.
- `WorkoutExercise.position` is unique within one workout.
- `Workout` references exactly one `TrainingPlan`.
- offered options are gym-specific via `PlanExerciseOption`.
- `WorkoutSet.load_canonical_kg` is always stored, even when display unit is `lbs`.
- `WorkoutSet.load_display_value` must exist in the selected station `LoadProfile` steps.

---

## Progression Read Model (Derived)

Progress suggestions should be computed from history, not manually duplicated.

Minimum dimensions for progression queries:

- `exercise_id`
- `selected_variant_id` (if present)
- `selected_station_id` or station equivalence group
- recent successful `WorkoutSet` loads and reps

---

## Implementation Strategy for pb-004

This plan should establish domain foundations without renderer integration.

Planned implementation depth:

- domain document finalized in this file
- database schema for entities above
- seed/init script with realistic dummy data:
  - one training plan with five exercises
  - multiple variants per exercise where meaningful
  - at least two gyms
  - station-specific load profiles including `kg` and `lbs`
  - explicit load steps (for example 2.0 kg, 2.5 kg, 10 lbs increments)
- backend domain entities and persistence mappings
- optional API contract placeholders/types, but no full workout wizard endpoints yet

---

## Explicitly Deferred

- renderer integration of real domain data
- full progression algorithm behavior
- authentication, authorization, and multi-user ownership enforcement
- advanced station equivalence and transfer-learning rules

---

## Open Decisions

- whether `WorkoutSet` should also store per-side load for unilateral exercises
- whether station equivalence should be explicit in schema (`equipment_station_group`) in pb-004
- whether warm-up sets are separate records or flagged `WorkoutSet` entries
- whether `TrainingPlanExercise` should support per-variant prescription defaults

---

## Change Notes

- 2026-03-10: Replaced temporary bootstrap model with full training domain baseline for plan pb-004 discussion.
