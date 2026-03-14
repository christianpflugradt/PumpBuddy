# Plan: Backend application validation is coupled to HTTP transport errors

## Item Reference

- `agent/execution/open-item-16.md`

## Goal Summary

Decouple application-layer validation from HTTP transport errors by introducing application-local error types and mapping them to HTTP responses only at the API boundary.

## Implementation Approach

- Introduce an application-local error type (likely in `backend/src/application/` or a shared `backend/src/application/errors.rs`) for validation and persistence failures surfaced to the API layer.
- Update application validation functions in `backend/src/application/workouts.rs` to return the new error type instead of `ApiError`, and remove any imports from `backend/src/api`.
- Adjust `backend/src/api/handlers.rs` (and related error mapping helpers) to translate application-local errors into `ApiError`/HTTP responses, preserving existing external behavior.

## Risks and Assumptions

- Assumes current HTTP status codes and response shapes are documented implicitly in `backend/src/api/error.rs`; need to preserve them while moving the mapping logic.
- Potential for overlooked call sites outside the main handlers that currently depend on `ApiError` from application code.

## Validation Plan

- Run unit/integration tests covering validation and API error responses if present; add or adjust tests if error mapping behavior changes.
- Sanity-check handlers for unchanged HTTP status codes and error messages for known validation failures.

## Out of Scope

- Redesigning validation rules or changing externally visible API error semantics.
- Broad refactors of API or persistence layers beyond the required error type decoupling.

## Handoff Notes for Implementation

- Keep `backend/src/main.rs` thin and preserve separation between API transport and application logic per engineering guardrails.
- Avoid introducing new dependencies; reuse existing error handling patterns where possible.
