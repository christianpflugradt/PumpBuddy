# Plan: Restore backend quality automation

## Item Reference

- `agent/execution/open-item-0001.md`

## Goal Summary

Restore the backend CI quality flow so backend changes run formatting, linting, tests, and enforced branch coverage with repository-native Rust tooling.

## Implementation Approach

- Inspect the current GitHub Actions and backend tooling to identify why backend quality checks are not running or not aligned with `backend/Cargo.toml`.
- Update CI so backend-scoped changes trigger a backend quality job that runs `cargo fmt --manifest-path backend/Cargo.toml --check`, `cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings`, backend tests, and branch coverage verification.
- Add or adjust executable project tooling for backend branch coverage so the threshold is defined in code or scripts rather than prose, and make CI invoke that same command.
- Document the supported local coverage verification command in the CI or adjacent project tooling so local execution matches CI expectations.

## Risks and Assumptions

- Branch coverage support may require additional Rust tooling such as LLVM coverage helpers; the implementation should prefer a stable, well-supported approach that fits CI and local development.
- Existing workflow path filters or job conditions may need adjustment so backend-only changes reliably trigger the quality job without broadening unrelated CI scope.
- Coverage thresholds should be pragmatic enough to pass on the current backend baseline while still enforcing regression protection.

## Validation Plan

- Run `cargo fmt --manifest-path backend/Cargo.toml --check`.
- Run `cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings`.
- Run the backend test command used by CI and confirm it succeeds in the supported local setup.
- Run the backend coverage verification command locally, confirm it measures branch coverage, and verify it fails below the configured threshold.
- Validate the workflow definition references the same backend coverage command and is scoped to backend changes.

## Out of Scope

- Renderer or frontend quality tooling changes.
- Coverage badges or broader reporting beyond the enforced backend threshold.

## Handoff Notes for Implementation

- Keep the threshold and coverage command in executable repository tooling, not only in workflow prose.
- Preserve the current stack choices: Rust backend, GitHub Actions automation, and repository-local scripts where they improve repeatability.
- Prefer reusing existing workflow and backend command structure instead of introducing parallel quality entry points.
