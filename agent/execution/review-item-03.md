# Enforce Local Pre-Push Quality Gate

## Goal

Provide a repository-managed pre-push workflow that reliably runs the local quality gate before pushes proceed.

## Scope

- add the repository automation needed to install or maintain a pre-push hook that invokes the supported local quality command
- ensure the hook blocks pushes when quality checks or required artifact-freshness checks fail
- document the minimal developer setup needed to enable the managed pre-push hook locally

## Acceptance Criteria

- a repository-managed pre-push hook path exists and runs the project quality gate before allowing `git push` to continue
- the documented setup command installs or enables the hook without manual file copying
- with the hook enabled, a forced failure inside the quality command causes the pre-push hook to exit non-zero
- `agent/scripts/run-quality.sh check` remains the single quality entrypoint invoked by the hook

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/scripts/run-quality.sh`
- `.github/workflows/ci-quality.yml`

## Dependencies

- `item-02`

## Out of Scope

- server-side Git hooks or hosted workflow retry automation
