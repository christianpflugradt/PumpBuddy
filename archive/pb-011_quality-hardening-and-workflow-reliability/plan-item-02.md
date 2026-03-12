# Plan: Add Quality Artifact Freshness Checks

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Make the local quality workflow fail when required generated quality artifacts are older than the commands that regenerate them, while keeping the checks reproducible and aligned with the existing quality entrypoints.

## Implementation Approach

- Identify and encode the required quality artifact set used by current quality commands, including the backend coverage summary and coverage badge outputs if they are treated as required checked-in artifacts.
- Add a small freshness-check step to the quality flow so `agent/scripts/run-quality.sh check` validates artifact presence and staleness against the canonical regeneration commands instead of relying on implicit expectations.
- Keep regeneration ownership with the existing backend and renderer coverage scripts, and make the freshness check compare tracked artifact timestamps or content against the outputs those commands produce.
- Document the required artifacts and regeneration path close to the script logic so the repository does not depend on hidden assumptions.

## Risks and Assumptions

- The check needs to distinguish required checked-in artifacts from transient build outputs under `target/` so normal local builds do not create false failures.
- Backend and renderer quality currently regenerate badges in different scripts, so the freshness contract should stay centralized even if implementation hooks remain split.
- Reproducibility matters more than speed here; a slightly slower `check` path is acceptable if it avoids flaky stale-artifact detection.

## Validation Plan

- Run `sh agent/scripts/run-quality.sh -h` and verify usage still prints successfully.
- Intentionally make one required artifact stale, then run `agent/scripts/run-quality.sh check` and verify it fails with a clear freshness error.
- Run the documented regeneration commands, rerun `agent/scripts/run-quality.sh check`, and verify the quality workflow succeeds again.

## Out of Scope

- Adding CI or post-push automation that repairs stale artifacts automatically.
- Expanding the quality workflow beyond artifact freshness detection for the currently required quality outputs.

## Handoff Notes for Implementation

- Prefer a single source of truth for the required artifact list and each artifact's regeneration command.
- Keep the final behaviour CI-aligned with the existing `backend`, `renderer`, and `check` entrypoints rather than introducing a parallel quality path.
