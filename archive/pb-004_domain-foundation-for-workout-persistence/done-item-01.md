# Define Domain Schema in init.sql

## Goal

Establish a complete PostgreSQL schema in `init.sql` for the pb-004 training domain entities and constraints.

## Scope

- add a database initialization script at `backend/init.sql`
- define tables, foreign keys, uniqueness constraints, and core check constraints for:
  - `training_plans`, `training_plan_exercises`
  - `exercises`, `exercise_variants`, `exercise_variant_equipment_compatibilities`
  - `gyms`, `equipment_stations`, `load_profiles`, `load_steps`
  - `plan_exercise_options`
  - `workouts`, `workout_exercises`, `workout_sets`
- include deterministic creation order so a fresh database can be initialized from this script alone

## Acceptance Criteria

- `backend/init.sql` creates all required domain tables and relationship constraints described in `agent/design/domain-model.md`
- schema enforces ordering uniqueness for plan/workout exercise positions and option uniqueness for gym-specific plan exercise options
- executable verification:  
  `docker compose down --volumes && docker compose up --build -d postgres && docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy -f /docker-entrypoint-initdb.d/init.sql`

## References

- `agent/strategy/plan.md`
- `agent/design/domain-model.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`

## Out of Scope

- inserting final seed dataset
- Rust backend persistence implementation
- API endpoint additions beyond existing bootstrap route


## Review Acceptance

- Criteria Met: `backend/init.sql` defines all required domain tables with foreign keys and check/uniqueness constraints aligned to `agent/design/domain-model.md`, including ordered-position uniqueness (`training_plan_exercises`, `workout_exercises`) and gym-specific option uniqueness (`plan_exercise_options`).
- Evidence: Verified table coverage for `training_plans`, `training_plan_exercises`, `exercises`, `exercise_variants`, `exercise_variant_equipment_compatibilities`, `gyms`, `equipment_stations`, `load_profiles`, `load_steps`, `plan_exercise_options`, `workouts`, `workout_exercises`, and `workout_sets`; verified key constraints `training_plan_exercises_plan_position_unique`, `workout_exercises_workout_position_unique`, and `plan_exercise_options_unique`; creation order is deterministic and dependency-safe.
- Runtime/Build Check: Executed `for i in 1 2 3 4 5 6 7 8 9 10; do docker compose exec -T postgres pg_isready -U pumpbuddy -d pumpbuddy && break; sleep 1; done && docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy -f /docker-entrypoint-initdb.d/init.sql` after container startup; observed `/var/run/postgresql:5432 - accepting connections`, `BEGIN`, table creation notices/results, and `COMMIT`.
- Residual Risk: none identified
