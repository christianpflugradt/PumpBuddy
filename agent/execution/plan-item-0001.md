# Plan: Define Domain Schema in init.sql

## Item Reference

- `agent/execution/open-item-0001.md`

## Goal Summary

Create `backend/init.sql` so a fresh PostgreSQL instance can initialize all pb-004 domain tables and constraints in one deterministic run.

## Implementation Approach

- Map required entities and invariants from `agent/design/domain-model.md` into SQL table definitions.
- Implement schema in dependency-safe order: base lookup tables, plan/exercise structures, gym/station/load structures, then workout execution tables.
- Add primary keys, foreign keys, uniqueness constraints, and core check constraints, including:
  - unique exercise ordering within plan and workout contexts
  - unique gym-specific plan exercise option combinations
  - positive/index-like bounds for ordered positions and set indices
- Keep SQL explicit and readable (no ORM, no migration framework), aligned with engineering guardrails and SQLx-oriented backend direction.

## Risks and Assumptions

- Assumes UUID key strategy and timestamp defaults are acceptable for all new tables.
- Constraint naming collisions or table-order mistakes can break one-shot initialization; creation order must remain deterministic.
- Some domain invariants (for example advanced semantic compatibility rules) may remain application-level if impractical as SQL checks.

## Validation Plan

- Run the acceptance verification command exactly:
  - `docker compose down --volumes && docker compose up --build -d postgres && docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy -f /docker-entrypoint-initdb.d/init.sql`
- Confirm all tables and constraints are created without SQL errors on a fresh database.
- Spot-check uniqueness and foreign-key behavior with a few insert attempts (valid and invalid) in the same `psql` session.

## Out of Scope

- Final seed dataset insertion.
- Rust backend persistence implementation.
- API endpoint additions beyond the existing bootstrap route.

## Handoff Notes for Implementation

- Keep the item scoped to schema definition only; do not expand into runtime/API code.
- Preserve acceptance criteria wording and verification path from the open item.
- If any domain-model detail is ambiguous, prefer conservative constraints and document rationale in implementation output.
