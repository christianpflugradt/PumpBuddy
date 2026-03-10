# Seed Realistic Domain Data in init.sql

## Goal

Populate `init.sql` with realistic pb-004 seed data that satisfies all plan data requirements across gyms, plans, variants, and load profiles.

## Scope

- extend `backend/init.sql` with deterministic inserts for:
  - exactly two gyms
  - exactly two plans named `Push Day` and `Pull Day`
  - exactly five plan exercises per plan
  - at least two multi-variant exercises per plan
  - gym-specific `plan_exercise_options` with different variant/station offerings between gyms
  - load profiles and load steps including both `kg` and `lbs` examples
- ensure inserted data respects schema constraints and relationship integrity

## Acceptance Criteria

- running `backend/init.sql` on a clean database inserts complete domain seed data matching all pb-004 seed constraints
- seed data includes explicit `load_steps` values for both metric and imperial examples
- executable verification:
  `docker compose down --volumes && docker compose up --build -d postgres && docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy < backend/init.sql`
- executable verification:
  `docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy -c "SELECT name FROM training_plans ORDER BY name; SELECT training_plan_id, COUNT(*) FROM training_plan_exercises GROUP BY training_plan_id ORDER BY training_plan_id;"`

## References

- `agent/strategy/plan.md`
- `agent/design/domain-model.md`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-0001`

## Out of Scope

- Rust SQLx query/repository implementation
- new HTTP API routes
