# Plan: The repository has no automated practical performance baseline

## Item Reference

- `agent/execution/open-item-19.md`

## Goal Summary

Add a lightweight automated performance smoke check for a critical runtime path with a documented threshold or comparison policy, runnable locally and in CI without hidden setup.

## Implementation Approach

- Identify the highest-value smoke path (likely backend API latency on seeded data or stack readiness) and confirm existing scripts or CI hooks to extend.
- Add a small, reproducible performance smoke script (shell or Rust/TS helper) that runs the chosen measurement and emits a clear pass/fail result.
- Wire the smoke check into the existing quality/CI flow (e.g., `agent/scripts/run-quality.sh` and CI workflow) with a documented threshold or policy.
- Document how to run the baseline and the threshold rationale in an appropriate README or script header.

## Risks and Assumptions

- Risk: noisy timing on shared CI runners could cause flaky failures; mitigate with generous thresholds or comparative policy.
- Assumption: a simple, single-path smoke check is sufficient for an initial baseline and can be expanded later.

## Validation Plan

- Run the new performance smoke command locally and confirm deterministic pass/fail output.
- Ensure the CI workflow executes the smoke check and fails on threshold violations.

## Out of Scope

- Full performance benchmarking suite or extensive profiling.
- Multiple endpoints or UI flows beyond the single critical path.

## Handoff Notes for Implementation

- Keep the check lightweight and fast to avoid slowing CI materially.
- Prefer existing tooling and minimal dependencies; avoid introducing heavy frameworks.
