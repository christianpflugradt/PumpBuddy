# Plan: Define Active Workout API Contract

## Item Reference

- `agent/execution/open-item-0002.md`

## Goal Summary

Define the OpenAPI contract for the active workout lifecycle so the renderer and backend share explicit request and response shapes for first-save, later-save, resume lookup, completion, and cancellation.

## Implementation Approach

- Extend `agent/design/api-contract.yaml` with active workout lifecycle endpoints under `/api/active-workout` or an equivalent workout-focused path family that keeps creation, update, retrieval, completion, and cancellation operations coherent.
- Model the first persisted write separately from later updates so the contract makes the create-versus-update boundary explicit instead of relying on undocumented client behavior.
- Add reusable schemas for active workout progress, per-exercise persisted state, and resume payloads so the renderer can restore the unfinished workout without inventing fields.
- Define error responses for invalid payloads, missing active workouts, and invalid active-workout state transitions where those failures are relevant to the lifecycle operations.
- Reuse existing workout identifiers and summary schema patterns where that keeps the contract consistent, but avoid changing the item scope beyond the active workout lifecycle.

## Risks and Assumptions

- The existing contract already has completed workout endpoints, so the new active-workout paths and schemas should stay clearly separated from the completed workout creation flow.
- The item only changes the contract, so endpoint naming and schema granularity should support the documented use case without assuming backend handler internals.
- The current product slice assumes at most one active workout should exist; the contract should support resume of that single active workout without adding recovery semantics for duplicate active workouts.

## Validation Plan

- Review `agent/design/api-contract.yaml` to confirm the lifecycle operations cover first-save, later-save, resume lookup, completion, and cancellation.
- Verify the resume response schema includes enough persisted progress to reconstruct the unfinished workout state used by the renderer.
- Run `rg -n "active workout|resume|cancel|complete" agent/design/api-contract.yaml` and confirm the matches cover the new lifecycle operations and related schema names.

## Out of Scope

- backend handler implementation
- frontend API integration
- workout history, analytics, or broader workflow redesign

## Handoff Notes for Implementation

- Keep the contract contract-first: OpenAPI YAML remains the canonical source.
- Keep user-facing semantics aligned with the documented English-only workout flow in the design artifacts.
- Prefer schema reuse where it keeps the YAML maintainable, but keep the active workout lifecycle readable for later implementation work.
