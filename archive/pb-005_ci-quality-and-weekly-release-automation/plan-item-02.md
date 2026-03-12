# Plan: Item 0002 - Backend CI Quality Gate

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Add a backend-focused CI quality gate for pull requests by enforcing Rust format, lint, and test checks only when backend-relevant files change.

## Implementation Approach

- Update `.github/workflows/ci-quality.yml` to include a backend job that runs only when backend-related paths are modified.
- Configure the backend job to run `cargo fmt --manifest-path backend/Cargo.toml --check`.
- Configure the backend job to run `cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings`.
- Configure the backend job to run `cargo test --manifest-path backend/Cargo.toml`.
- Keep backend checks scoped to backend tooling and avoid changes to renderer checks or release workflow concerns.

## Risks and Assumptions

- Assumes existing CI workflow already has a path-filter or equivalent pattern that can be extended for backend-relevant changes.
- Risk that CI image/toolchain may not include required Rust components; if missing, add explicit setup within the backend job.
- Assumes backend commands pass in a clean repository state without additional environment dependencies.

## Validation Plan

- Verify workflow syntax and conditional gating logic in `.github/workflows/ci-quality.yml`.
- Run executable verification locally:
  `cargo fmt --manifest-path backend/Cargo.toml --check && cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings && cargo test --manifest-path backend/Cargo.toml`.
- Confirm that backend CI job triggers when backend paths change and does not trigger for renderer-only changes.

## Out of Scope

- renderer lint/test setup
- semantic-release configuration

## Handoff Notes for Implementation

- Keep the OpenAPI/contract-first and explicit SQLx constraints unchanged; this item is CI enforcement only.
- Preserve existing workflow structure and naming conventions unless changes are required for clean backend gating.
- If path filters are centralized in a prior job, consume those outputs rather than duplicating filter logic.
