# Plan: Fix Coverage Badges Pages Workflow Tooling

## Item Reference

- `agent/execution/open-item-20.md`

## Goal Summary

Update the coverage badges GitHub Pages workflow to run on a supported Node version and ensure `llvm-cov` is available so badge artifacts publish successfully.

## Implementation Approach

- Review `.github/workflows/coverage-badges-pages.yml` and bump the Node setup step to a supported version aligned with repo tooling.
- Update `agent/scripts/prepare-pages-artifacts.sh` or workflow steps to install `llvm-tools-preview` via `rustup` or set `LLVM_COV` so `llvm-cov` resolves in CI.
- Verify the workflow step that generates coverage badges produces the expected artifact paths referenced by `README.md` badges.

## Risks and Assumptions

- Assume the workflow uses Rust toolchains already; installing `llvm-tools-preview` will not conflict with existing caching or toolchain setup.
- Badge artifact paths in the workflow still match README badge URLs; if not, adjust only the workflow outputs, not README scope.

## Validation Plan

- Run or inspect the updated workflow to confirm `llvm-cov` is available during `prepare-pages-artifacts.sh`.
- Confirm the coverage badge artifact directory/files exist and match the README badge references.

## Out of Scope

- Changing coverage tooling beyond ensuring `llvm-cov` availability.
- Modifying README content or badge URLs unless required by current workflow outputs.

## Handoff Notes for Implementation

- Prefer `rustup component add llvm-tools-preview` in CI unless a stable `LLVM_COV` path is already defined in the workflow.
- Keep Node version consistent with repo tooling guidance and GitHub Actions supported versions.
