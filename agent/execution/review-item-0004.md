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
- Evidence: In the reviewed commit `2fe4d76` (`feat(repo): add root quality command`), the primary entrypoint exists as `make check` and delegates to `agent/scripts/run-quality.sh check`. I validated the committed state in a temporary snapshot at `/tmp/pb-review-0004` with renderer dependencies linked from the prepared local environment. Executing `make check` from the repository root exits non-zero during backend validation because `cargo fmt --manifest-path /private/tmp/pb-review-0004/backend/Cargo.toml --check` reports formatting diffs in `backend/src/main.rs` around lines 1158, 1215, and 1298.
- Risk: Accepting the item would mark a broken repository-root quality command as complete. Developers following the documented local workflow would fail before reaching the rest of the CI-aligned checks, which undermines the main usability and verification goal of the item.

### Additional Notes

- The structure is otherwise aligned with the item. `Makefile` provides one top-level command, `agent/scripts/run-quality.sh` centralizes the backend and renderer command lists, `README.md` documents `make check`, and `.github/workflows/ci-quality.yml` reuses the shared script instead of duplicating the quality steps.
