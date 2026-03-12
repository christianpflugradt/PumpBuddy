# Add Quality Artifact Freshness Checks

## Goal

Make the local quality workflow fail when required generated or batch-updated quality artifacts are stale relative to the commands that regenerate them.

## Scope

- identify the quality artifacts that must stay current for this repository, including coverage badge outputs if they are treated as required outputs
- update the quality scripts so stale artifacts are detected during local quality runs
- keep the artifact checks reproducible and aligned with the existing CI-oriented quality entrypoints

## Acceptance Criteria

- running `agent/scripts/run-quality.sh check` fails when a required generated quality artifact is intentionally made stale
- running the documented regeneration commands followed by `agent/scripts/run-quality.sh check` succeeds again
- the implementation documents or encodes the exact required artifact set instead of relying on hidden assumptions
- `sh agent/scripts/run-quality.sh -h` still prints usage successfully

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/scripts/run-quality.sh`
- `agent/scripts/check-backend-coverage.sh`
- `renderer/scripts/run-coverage.mjs`

## Out of Scope

- adding post-push repair automation in GitHub Actions
