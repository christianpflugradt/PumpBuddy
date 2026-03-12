# Plan: Add Meaningful Backend Tests And Coverage Follow-Through

## Item Reference

- `agent/execution/open-item-07.md`

## Goal Summary

Add or strengthen backend tests around meaningful API, persistence, and PostgreSQL-backed workout behavior so the refactored backend keeps credible confidence and still satisfies the branch-coverage gate.

## Implementation Approach

- Inspect the backend modules produced by the refactor and identify the highest-risk seams that changed, especially active workout request handling, persistence writes/reads, and suggestion or hydration behavior.
- Add focused tests at the correct layer: keep pure validation or mapping coverage near extracted backend logic, and keep PostgreSQL-backed repository behavior in integration tests rather than padding entrypoint tests.
- Consolidate duplicated database-test setup only as far as needed to support the new coverage-targeted tests cleanly and keep integration execution deterministic enough for the expected test path.
- Review `agent/scripts/check-backend-coverage.sh` alongside the new test mix and adjust the branch threshold only if an explicit repository standard now requires it.

## Risks and Assumptions

- Item-05 and item-06 are assumed to have established cleaner backend module boundaries; if they did not, test placement may need a minimal supporting refactor first.
- PostgreSQL-backed tests remain important for this item, so any optional local ergonomics must not hide expected coverage in the intended validation path.
- Coverage should improve through behavior-focused assertions, not through low-value line-filling tests.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml`.
- Run `agent/scripts/check-backend-coverage.sh`.
- Confirm the added or updated tests exercise meaningful backend behavior that changed during the refactor, especially persistence-backed workout flows.

## Out of Scope

- Renderer test expansion or Playwright work.
- Broad production refactors beyond the minimal support needed to place durable backend tests.
- Coverage-gate changes without an explicit standards-based justification.

## Handoff Notes for Implementation

- Use the structure review as a guide for where duplicated harness logic or silent integration skips may be weakening confidence.
- Prefer shared backend test support over copying more fixture and database bootstrapping code into large files.
- Keep `backend/src/main.rs` thin; avoid solving test gaps by pushing more test-only logic back into the entrypoint.
