# Plan: Seed Realistic Domain Data in init.sql

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Populate `backend/init.sql` with deterministic, realistic seed data covering gyms, plans, exercises, variants, station options, and load profiles/load steps so pb-004 data constraints are fully satisfied.

## Implementation Approach

- Review existing `backend/init.sql` insert order and extend it without breaking referential integrity.
- Insert exactly two gyms and exactly two training plans (`Push Day`, `Pull Day`) using stable keys/order.
- Insert exactly five `training_plan_exercises` per plan, ensuring at least two exercises per plan support multiple variants.
- Insert gym-specific `plan_exercise_options` so variant/station offerings differ between the two gyms.
- Insert load profiles and explicit `load_steps` with both `kg` and `lbs` examples.
- Keep SQL idempotence and determinism expectations aligned with clean-db bootstrap usage in scope.

## Risks and Assumptions

- Assumption: current schema names and constraints in `backend/init.sql` match the domain references and allow required relationships.
- Risk: seed inserts can fail if FK ordering is incorrect or if uniqueness constraints are unintentionally duplicated.
- Risk: variant/station differentiation across gyms may be under-specified; implement explicit per-gym option rows to avoid ambiguity.

## Validation Plan

- Execute: `docker compose down --volumes && docker compose up --build -d postgres && docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy < backend/init.sql`
- Execute: `docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy -c "SELECT name FROM training_plans ORDER BY name; SELECT training_plan_id, COUNT(*) FROM training_plan_exercises GROUP BY training_plan_id ORDER BY training_plan_id;"`
- Run targeted SQL checks for:
  - exactly two gyms
  - plans `Push Day` and `Pull Day`
  - exactly five exercises per plan
  - presence of both `kg` and `lbs` load-step examples

## Out of Scope

- Rust SQLx query or repository changes
- HTTP API additions or behavior changes
- domain-model redesign beyond seed-data content required by this item

## Handoff Notes for Implementation

- Preserve item acceptance criteria exactly; do not broaden scope.
- Keep seed data realistic but compact and deterministic for repeatable local bootstrap/testing.
- If schema friction appears, adapt insert ordering/joins while keeping required dataset shape unchanged.
