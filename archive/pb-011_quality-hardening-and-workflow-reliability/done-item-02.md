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


## Review Acceptance

- Criteria Met: All acceptance criteria are satisfied. `agent/scripts/run-quality.sh check` snapshots and verifies a centralized required artifact list, fails when a required badge artifact is stale, succeeds again after regeneration, and `sh agent/scripts/run-quality.sh -h` still prints usage.
- Evidence: [`agent/scripts/check-quality-artifacts.sh`](agent/scripts/check-quality-artifacts.sh#L6) encodes the exact required artifact set and regeneration commands for backend and renderer coverage badges. [`agent/scripts/run-quality.sh`](agent/scripts/run-quality.sh#L43) integrates the snapshot/verify flow around the existing backend and renderer quality entrypoints so stale artifacts are detected during the CI-aligned `check` path.
- Runtime/Build Check: `printf '\nreview-stale-marker\n' >> badges/renderer-coverage.json && sh agent/scripts/run-quality.sh check` exited `1` after backend and renderer quality passed, reporting `Required quality artifact was stale: badges/renderer-coverage.json`; rerunning `sh agent/scripts/run-quality.sh check` after the badge was regenerated exited `0`; `sh agent/scripts/run-quality.sh -h` printed the documented usage text successfully.
- Residual Risk: None identified beyond the review-state mismatch in the current worktree, where the candidate changes are still local rather than already represented by a review-transition commit.
