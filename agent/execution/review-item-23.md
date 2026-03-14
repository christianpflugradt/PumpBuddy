# Relax CI Quality Gate To Tests-Only

## Goal

Update CI quality requirements so the workflow passes when tests succeed, without enforcing a coverage percentage gate.

## Scope

- identify the CI quality job configuration and remove/disable any coverage percentage threshold checks
- ensure the quality workflow still runs the test suite and reports pass/fail
- update any related documentation or README notes if they mention a coverage gate

## Acceptance Criteria

- CI quality job completes successfully when tests pass, even if coverage is below any previous threshold
- CI quality job fails when tests fail
- verification: run the CI workflow (or an equivalent local command) to confirm the updated behavior

## References

- `agent/strategy/plan.md`
- `README.md`
- `.github/workflows`

## Notes for Review

- Stakeholder reported CI quality failing due to coverage gating; requirement is now tests-only.
