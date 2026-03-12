# Plan: Remove Hello World Bootstrap Surface

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Remove the obsolete Hello World endpoint, renderer bootstrap path, and contract definitions so the active product surface only covers workout behavior.

## Implementation Approach

- remove the backend route, handler, and any supporting code that exists only for `GET /api/hello-world`
- remove renderer startup logic, UI code, and assets that still depend on the Hello World bootstrap flow
- update `agent/design/api-contract.yaml` to delete the Hello World path and any schemas that are only referenced by that slice
- clean up tests or startup checks so backend and renderer coverage reflects the workout-only startup path

## Risks and Assumptions

- Hello World references may still be wired through shared startup code, so cleanup needs to avoid breaking the remaining workout initialization path
- contract changes and implementation changes must stay aligned so generated or validated API expectations do not drift
- the acceptance grep allows historical references under `archive/`, but active-surface references under backend, renderer, and the canonical contract must be removed

## Validation Plan

- run `rg -n "hello-world|Hello World" backend renderer agent/design/api-contract.yaml` and confirm there are no active-surface matches
- run `cargo test --manifest-path backend/Cargo.toml`
- run `npm test --prefix renderer`

## Out of Scope

- changing workout behavior beyond removing obsolete bootstrap dependencies
- broader contract refactors unrelated to the Hello World cleanup
- archive or historical-document cleanup outside the active product surface

## Handoff Notes for Implementation

- treat `agent/design/api-contract.yaml` as the canonical API contract while removing the obsolete endpoint
- prefer deleting dead code paths outright instead of keeping compatibility shims for the removed bootstrap slice
