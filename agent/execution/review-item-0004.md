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
