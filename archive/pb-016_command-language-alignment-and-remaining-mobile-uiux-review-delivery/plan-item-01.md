# Plan: Align Makefile Command Language

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Align Makefile targets with the agreed product-oriented command language and remove superseded target names while preserving existing behavior.

## Implementation Approach

- Update target definitions in `Makefile` to the exact names: `run-app`, `stop-app`, `rebuild-app`, `setup-dev`, `refresh-api-clients`, `refresh-backend-api-client`, and `refresh-frontend-api-client`.
- Keep `check` unchanged and preserve each renamed target's existing command behavior.
- Ensure `stop-app` maps to Docker Compose stop behavior.
- Remove legacy target names entirely, including phony declarations, without adding compatibility aliases.

## Risks and Assumptions

- Assumes renamed targets currently exist with stable behavior that can be transferred directly.
- Removing old target names may break local scripts that still call legacy names.

## Validation Plan

- Run `make -n run-app stop-app rebuild-app setup-dev refresh-api-clients refresh-backend-api-client refresh-frontend-api-client check`.
- Confirm legacy renamed targets are not callable from `Makefile` target definitions.

## Out of Scope

- Any behavior changes to the underlying commands beyond target renaming.
- Adding compatibility aliases or deprecation wrappers for legacy target names.

## Handoff Notes for Implementation

- Keep the change limited to naming and target exposure.
- Verify acceptance criteria command names match exactly.
