# Plan: Add Backend Rust Dependency Cache In CI

## Item Reference

- `agent/execution/open-item-09.md`

## Goal Summary

Reduce backend CI quality job runtime by adding standard Rust dependency caching while keeping existing checks and coverage behavior intact.

## Implementation Approach

- Update `.github/workflows/ci-quality.yml` backend job to add a maintained Rust cache action aligned with the existing toolchain setup order.
- Keep the backend quality command sequence unchanged in intent (lint/test/coverage flow remains the same).
- Ensure cache keys are derived from Rust lockfile/toolchain context through the cache action defaults to avoid custom fragile key logic.
- Capture before/after backend job timing evidence from CI runs (or a reproducible local equivalent) and record the comparison in item implementation notes.

## Risks and Assumptions

- Cache warmup may make the first run slower; improvement is expected on subsequent runs.
- Cache effectiveness depends on lockfile/toolchain stability and GitHub-hosted runner cache availability.
- Workflow edits must avoid changing job semantics beyond dependency caching.

## Validation Plan

- Verify workflow syntax and step ordering keep existing backend quality behavior unchanged.
- Run CI quality workflow and confirm backend job completes successfully with cache step present.
- Compare runtime evidence for backend job before and after change and confirm measurable improvement.

## Out of Scope

- Introducing `cargo-chef`, multi-layer custom caching, or broader CI pipeline redesign.

## Handoff Notes for Implementation

- Prefer a widely used maintained action (for example `Swatinem/rust-cache`) in standard placement after Rust toolchain setup.
- Keep the change narrowly scoped to backend caching and related evidence capture.
