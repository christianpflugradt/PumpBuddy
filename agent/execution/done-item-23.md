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


## Review Acceptance

- Criteria Met: CI quality now enforces tests-only behavior by removing coverage threshold checks while preserving backend and renderer test pass/fail enforcement.
- Evidence: `.github/workflows/ci-quality.yml` removed llvm/cargo-llvm-cov setup and coverage-specific path triggers; `agent/scripts/run-quality.sh` removed `check-backend-coverage.sh` and `npm run coverage:check`; README quality section now describes tests plus performance smoke instead of coverage gating.
- Runtime/Build Check: Executed `agent/scripts/run-quality.sh backend` from repo root; observed all backend tests passed (`26` unit, `3` API integration, `9` persistence integration) and performance smoke passed (`health_endpoint_latency_smoke ... ok`), demonstrating quality success is determined by test outcomes.
- Residual Risk: none identified
