# Plan: Enforce Non-Committed Generated Artifacts

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Ensure OpenAPI-generated backend and renderer model artifacts are not committed by default while keeping local and CI regeneration deterministic from checked-in sources.

## Implementation Approach

- Update `.gitignore` so generated OpenAPI model output directories for backend and renderer are excluded from version control.
- Keep generation output paths aligned with existing `Makefile` targets and ensure cleanup/rebuild remains deterministic.
- Add or update developer-facing documentation (likely `README.md`) to state the non-committed generated-artifact policy and regeneration workflow.

## Risks and Assumptions

- Assume generated output directories are build artifacts and not required as tracked files for runtime or CI.
- Risk of accidental broad ignore patterns; keep ignore entries narrow to avoid hiding unrelated files.

## Validation Plan

- Run OpenAPI generation (`make generate-openapi`) and verify outputs regenerate in the expected directories.
- Run `git status --short` after generation and confirm generated model files are not reported as tracked changes.
- Verify documentation clearly points to checked-in sources and deterministic regeneration commands for local/CI workflows.

## Out of Scope

- Introducing any default workflow that commits generated OpenAPI artifacts.

## Handoff Notes for Implementation

- Preserve item scope and acceptance criteria exactly; this plan only defines execution steps.
- If repository paths differ from assumptions, update ignore/doc references to match actual generation targets without expanding scope.
