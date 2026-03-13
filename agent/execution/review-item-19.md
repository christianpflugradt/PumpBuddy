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
