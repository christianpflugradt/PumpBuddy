# Plan: Add Minimal API Preparation for Domain Entities

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Prepare minimal API-contract and backend scaffolding for pb-004 domain entities so later plans can build orchestration safely on top of stable, read-oriented endpoints.

## Implementation Approach

- Update `agent/design/api-contract.yaml` with minimal, read-focused placeholder endpoints and schemas for plan/option discovery and workout summaries, explicitly excluding wizard orchestration commands.
- Regenerate or align backend contract bindings (if applicable in this repo workflow) and add route registration plus handler stubs for each new endpoint.
- Introduce minimal persistence-facing abstractions needed by the new handlers, returning stable placeholder payloads while preserving backend authority for business logic.
- Ensure topology and security boundaries remain unchanged (renderer public, backend internal, database internal).

## Risks and Assumptions

- Assumes endpoint naming and schema vocabulary can be derived from `agent/design/domain-model.md` without introducing new domain concepts.
- Risk of contract/handler drift if generated artifacts are required but not refreshed consistently.
- Risk of over-scaffolding into orchestration behavior; implementation must stay explicitly non-orchestrating.

## Validation Plan

- Verify OpenAPI contract structure is valid and consistent with existing contract organization.
- Run `cd backend && cargo check`.
- Run `cd backend && cargo test`.

## Out of Scope

- Workout wizard state machine or command orchestration endpoints.
- Renderer integration or UI wiring for the new endpoints.
- Permission model redesign beyond current security boundaries.

## Handoff Notes for Implementation

- Keep new handlers intentionally thin and deterministic; avoid speculative business logic.
- Prefer explicit TODO-style placeholders only where they do not weaken compile safety.
- If contract codegen is part of the backend build, keep generated output reproducible and avoid manual edits to generated files.
