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
- Configurator flows must prefer safe lifecycle transitions over destructive mutation when reference data can affect historical workout interpretation.

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
- Load profile names must remain unique within one user's configuration space.
- Gym names must remain unique within one user's configuration space. The same
  normalized Gym name may be used by different users.
- Draft load profiles may be edited or physically deleted while they remain `new`.
- Active or inactive load profiles keep their definition and weight unit read-only, but may still be renamed after an explicit warning.
- Load-profile previews must match the same capped distinct-load expansion that workout execution uses.
- Configurator lifecycle status uses `new`, `active`, and `inactive` as
  persisted/API values. `new` is called **Draft** in product and domain-facing
  language; it is not exposed as a user-facing lifecycle label.
- A draft Gym may be renamed or physically deleted. An active or inactive Gym
  may be renamed, but cannot be deleted or have its status changed. Lifecycle
  transitions are deferred until their domain triggers are defined.

---

## Workout Completion Result

The workout completion result compares the current workout with historical
performance. Its score is a relative performance indicator, not a judgment of
whether the workout was good or bad. PumpBuddy does not know the athlete's
intent and must not infer why a session is lighter, stable, or higher.

The completion result uses the existing score calculation, historical-reference
selection, per-exercise cap, aggregation, and thresholds unchanged:

- **Lower**: workout progress below `0.95`.
- **Stable**: workout progress from `0.95` through `1.03`, inclusive.
- **Higher**: workout progress above `1.03`.
- **Unavailable** remains separate when comparison data is insufficient.

These categories are not a red/yellow/green traffic light:

- **Lower / Blue (`#38BDF8`)** is deliberately neutral. It represents a lighter
  session without implying warning, error, failure, regression, poor
  performance, consolation, or intent.
- **Stable / Green (`#22C55E`)** represents the healthy positive normal case of
  maintaining roughly the recent level.
- **Higher / Gold/Orange (`#F59E0B`)** makes an increase feel special or
  celebratory without making continuous increases the expected default.

The existing directional arrow semantics and animation behavior are preserved.

### Completion Copy Principles

Completion messages must be motivating, positive, concise, natural, and human
without judging the workout or claiming more than the score establishes.

- Never assume that a lighter session was intentional.
- Never imply that Higher is the only desirable outcome or that the athlete
  should always do more.
- Never claim a PR, personal best, record, or similar achievement unless the
  underlying data establishes it.
- Avoid exaggerated fitness-app language.
- Avoid em dashes.
- Do not share messages between categories.
- Select uniformly within the matching category without weighting,
  score-dependent subcategories, or additional message logic.

Approved **Lower** messages:

1. A lighter session today. That's part of the process.
2. Not every session needs to push the limit.
3. Some days are lighter. The work still counts.
4. Every workout has its place.
5. A little less today. Plenty more ahead.
6. Another session done. Keep moving forward.

Approved **Stable** messages:

1. Right on track. Solid work today.
2. Consistency looks good on you.
3. Steady work adds up. Keep going.
4. Another solid session in the books.
5. You've found your rhythm. Keep it going.
6. Showing up and staying consistent. That's how it's done.
7. Keep doing what you're doing.
8. Steady today. Ready for what's next.

Approved **Higher** messages:

1. You stepped it up today. Great work!
2. You raised the bar today. Well done!
3. That's progress. Enjoy it!
4. A little more today. That's how progress builds.
5. You brought a little extra today. Nicely done!
6. Progress looks good on you.
7. Another step forward. Keep building!
8. Now that's a step up. Great work!

---

## Ubiquitous Language

- `TrainingPlan`: stable plan identity that groups all versions of one plan.
- `TrainingPlanVersion`: immutable snapshot of a plan that is used to start workouts.
- `Workout`: concrete execution instance of a plan.
- `WorkoutMode`: execution context of a workout (`configured_gym` or `free`).
- `ActiveWorkout`: an unfinished persisted `Workout` that the application should resume automatically on application startup.
- `Exercise`: canonical movement definition (for example: Butterfly).
- `ExerciseVariant`: concrete way to perform an exercise (cable seated, cable standing, machine, dumbbell incline).
- `Gym`: real-world fitness center. Its lifecycle status is `new`, `active`,
  or `inactive`; `new` is a Draft in user-facing language.
- `EquipmentStation`: concrete station in a gym (for example left cable tower, chest fly machine #2).
- `LoadProfile`: allowed load steps for a station or equipment class, including display unit.
- `ConfiguratorMode`: navigation mode for maintaining workout reference data outside normal workout browsing.
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
- user-driven transitions from `new` load profiles into `active` or `inactive` status
- lifecycle transitions for Gyms, including their triggering conditions

---

## Open Decisions

- whether `WorkoutSet` should also store per-side load for unilateral exercises
- whether station equivalence should be explicit in schema (`equipment_station_group`) in pb-004
- whether warm-up sets are separate records or flagged `WorkoutSet` entries
- whether option selection should always be user-driven or can auto-suggest top-ranked available options
