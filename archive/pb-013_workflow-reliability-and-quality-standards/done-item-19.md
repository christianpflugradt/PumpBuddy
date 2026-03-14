# The repository has no automated practical performance baseline

## Summary

The current quality posture includes functional tests and coverage checks, but there is no automated smoke benchmark or latency baseline for the backend API, renderer startup, or Compose stack, so performance regressions would currently land without a repository-level alarm.

## Evidence

- A repository search during this review found no active benchmark or performance harness under `backend/`, `renderer/`, `agent/scripts/`, or `.github/workflows/`.
- `agent/scripts/run-quality.sh` runs formatting, linting, tests, and coverage only; it does not execute any performance smoke check.
- The active test strategy lists performance testing only as an optional future category, so there is no implemented baseline confidence layer today.

## Goal

Introduce a lightweight automated performance baseline that provides early warning for major regressions in the most important runtime paths without turning the repository into a heavy benchmarking project.

## Scope

- choose one or two high-value smoke measurements, such as backend API latency on seeded data, renderer startup/render time, or Compose readiness time
- automate those measurements in a reproducible local and CI-friendly form
- keep the baseline lightweight and stable enough to maintain

## Acceptance Criteria

- the repository contains at least one automated performance smoke check for a critical runtime path
- the chosen performance signal has a documented threshold or comparison policy
- the performance baseline can be run without hidden manual setup

## References

- `agent/scripts/run-quality.sh`
- `agent/strategy/test-strategy.md`
- `.github/workflows/ci-quality.yml`
- `README.md`


## Review Acceptance

- Criteria Met: Added an automated backend performance smoke check for the critical `/health` runtime path, documented a threshold/override policy, and integrated execution into the repository quality workflow without hidden setup.
- Evidence: `backend/src/api/handlers.rs` includes `health_endpoint_latency_smoke`; `agent/scripts/run-quality.sh` adds `run_backend_performance_smoke` and calls it from backend quality; `README.md` documents default threshold (`50ms` across `40` requests) and `BACKEND_HEALTH_LATENCY_SMOKE_MAX_MS` override.
- Runtime/Build Check: Executed `agent/scripts/run-quality.sh performance`; observed `test api::handlers::tests::health_endpoint_latency_smoke ... ok` and overall `test result: ok` with no failures.
- Residual Risk: low; latency smoke checks are environment-sensitive and intended as a coarse regression alarm rather than a precise benchmark.
