# Plan: Persist Completed Workouts In Repository

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Add the backend repository write path for completed workouts so one submitted workout persists its parent workout row plus one exercise row and one set row per submitted exercise.

## Implementation Approach

- review the existing backend domain and persistence modules to identify the current create-workout input shape, repository traits, and SQLx transaction patterns already used in the codebase
- add or refine backend domain input types so the repository method can receive the selected training plan, gym, and per-exercise data required for a single completed workout write
- implement a transactional SQLx repository method that inserts into `workouts`, then `workout_exercises`, then `workout_sets`, wiring generated IDs through the full write path
- handle schema-required fields that are not yet collected by the renderer with explicit `NULL` values or clearly marked temporary dummy references, and document each temporary fallback directly in code comments
- add or update a focused backend test around `create_workout` that verifies one workout, one exercise row per submitted exercise, and one set row per exercise against PostgreSQL

## Risks and Assumptions

- the current schema may require foreign keys or non-null columns that are not fully represented in the current frontend flow, so the implementation must make temporary placeholder handling explicit without widening scope
- the repository may already expose partial workout persistence paths; if so, the change should extend them rather than introduce a parallel abstraction
- the acceptance criteria imply a fixed initial persistence shape of exactly one set per exercise, even if the domain will later support multiple sets

## Validation Plan

- run `cd backend && cargo test create_workout`
- confirm the test asserts the inserted workout is linked to the selected training plan and gym and that submitted exercises map to matching `workout_exercises` and `workout_sets` row counts

## Out of Scope

- incremental persistence while a workout is still in progress
- additional workout history query work beyond the existing summary path
- expanding the renderer to collect real values for fields currently satisfied by temporary placeholders

## Handoff Notes for Implementation

- keep persistence explicit with SQLx and a single transaction, consistent with repository guardrails
- prefer the smallest domain/API surface change that satisfies the repository write path
- any temporary dummy IDs or placeholder values must be called out in backend comments so future replacement work is obvious
