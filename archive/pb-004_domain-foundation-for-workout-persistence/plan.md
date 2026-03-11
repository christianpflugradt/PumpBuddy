# Plan: Domain Foundation for Workout Persistence

## Plan ID

pb-004

## Goal

Establish a durable domain foundation for workout persistence so that plan execution data can be stored in PostgreSQL and reused in upcoming API and renderer plans.

## Scope

- finalize the domain model in `agent/design/domain-model.md` for:
  - `TrainingPlan` and ordered `TrainingPlanExercise`
  - `Workout`, `WorkoutExercise`, and `WorkoutSet`
  - `Exercise`, `ExerciseVariant`, and compatibility mapping
  - `Gym`, `EquipmentStation`, `LoadProfile`, and `LoadStep`
  - gym-specific `PlanExerciseOption` for offered variants per plan exercise
- implement database initialization through `init.sql` only (no migration framework)
- provide realistic seed data in initialization SQL:
  - two gyms
  - two plans named exactly `Push Day` and `Pull Day`
  - each plan has five exercises matching the day focus
  - in each plan, at least two exercises have multiple variants
  - variant options are differently configured across the two gyms
  - load profiles include both `kg` and `lbs` examples with explicit step values
- implement backend domain and persistence foundations (Rust + SQLx) for the new model
- add minimal API preparation for new entities where it reduces future integration effort, without implementing full workout wizard endpoints
- add targeted tests validating schema initialization and core persistence behavior

## Out of Scope

- renderer integration with real domain data
- full workout wizard API flow and orchestration
- progression/recommendation business algorithm (only data foundations for future implementation)
- authentication and authorization features
- database migration framework introduction

## Success Criteria

- domain model document reflects agreed concepts and terminology in English
- a fresh local environment can initialize PostgreSQL from `init.sql` and produce complete dummy domain data
- seed data includes:
  - gyms: exactly 2
  - plans: exactly `Push Day` and `Pull Day`
  - exercises per plan: exactly 5 each
  - multi-variant exercises: at least 2 per plan
  - gym-specific variant option differences for overlapping exercises
- backend can read and persist core entities of the model via SQLx without renderer dependency
- tests provide meaningful confidence for initialization and primary persistence paths

## Constraints

- use English domain terms in model and implementation artifacts
- avoid migration tooling in this pre-MVP phase; rely on disposable local DB volume reset and `init.sql`
- keep API and renderer scope intentionally limited in this plan
- follow existing stack and engineering guardrails (Rust, SQLx, PostgreSQL, OpenAPI-first)

## Inputs

- `agent/design/domain-model.md`
- `agent/design/use-cases.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
