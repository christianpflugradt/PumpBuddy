# Add one primary local quality command

## Goal

Provide one primary local command that runs the same critical quality categories enforced by CI.

## Scope

- add a repository-level quality entrypoint such as `make check` that developers can run before push
- wire the command to invoke backend and renderer validation in a maintainable order
- keep the local command aligned with the CI quality workflow so category drift is minimized

## Acceptance Criteria

- one documented top-level command exists for running the repository quality checks locally
- the command covers the same critical categories as CI: backend validation, backend tests, backend coverage, renderer validation, renderer tests, and renderer coverage
- running the primary local command from the repository root succeeds in a correctly prepared local environment
- the implementation avoids duplicating long command lists across multiple places when a shared script or make target would keep maintenance simpler

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-0001`
- `item-0003`

## Out of Scope

- adding new product behavior
- publishing coverage badges

## Notes for Review

- compare the local entrypoint against CI and flag missing quality categories


## Review Findings

### Criterion

running the primary local command from the repository root succeeds in a correctly prepared local environment

- Status: fail
- Evidence: The committed root entrypoint exists as `make check`, which delegates to `agent/scripts/run-quality.sh check`, but executing `make check` from the repository root exits non-zero immediately in the backend validation phase. `cargo fmt --manifest-path backend/Cargo.toml --check` reports formatting diffs in `backend/src/main.rs` at the assertions around lines 1160, 1218, and 1301, so the new primary command does not currently complete successfully on the reviewed commit.
- Risk: Accepting the item would mark a broken repository-root quality command as complete. Developers following the documented workflow would fail before reaching the rest of the CI-aligned checks, undermining the item's main usability and verification goal.

### Additional Notes

- The structural approach is otherwise aligned with the item: `Makefile` provides a single top-level command, `agent/scripts/run-quality.sh` centralizes the backend and renderer command lists, and `.github/workflows/ci-quality.yml` now reuses that script for both jobs instead of duplicating the quality steps.
