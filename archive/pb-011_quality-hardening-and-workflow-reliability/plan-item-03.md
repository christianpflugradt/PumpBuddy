# Plan: Enforce Local Pre-Push Quality Gate

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Add a repository-managed way to enable a local `pre-push` hook that always runs the existing quality gate and blocks `git push` when that gate fails.

## Implementation Approach

- Add a versioned repository hook script under a stable project-managed path that delegates directly to `agent/scripts/run-quality.sh check` and exits non-zero on any failure.
- Add a small setup script or equivalent managed command that configures Git to use the repository hook path without requiring manual hook-file copying into `.git/hooks`.
- Document the minimal local setup in the existing repository docs, including the one command to enable the managed hook and the local prerequisites already required by the quality workflow.
- Keep the hook implementation thin so quality ownership stays centralized in `agent/scripts/run-quality.sh`, including the artifact freshness verification already handled by its `check` command.

## Risks and Assumptions

- A repository-level hook path likely depends on `git config core.hooksPath`, so the setup command needs to be explicit about whether it applies per-repository or per-clone.
- The hook must remain POSIX-shell friendly and executable on developer machines without introducing extra runtime dependencies beyond the current quality prerequisites.
- Documentation should make clear that developers can enable the hook locally, but the item does not require changing CI or adding any server-side enforcement.

## Validation Plan

- Run the documented setup command in a local clone and verify Git resolves the repository-managed `pre-push` hook path.
- Trigger the hook with a forced failure inside `agent/scripts/run-quality.sh check` and verify `git push` is blocked with a non-zero hook exit.
- Restore normal behaviour and verify the hook invokes `agent/scripts/run-quality.sh check` successfully without introducing a second quality entrypoint.

## Out of Scope

- Server-side Git hooks or GitHub-side push enforcement.
- Expanding the hook to run checks beyond the existing repository quality gate.

## Handoff Notes for Implementation

- Prefer storing hook assets in a tracked repository directory rather than generating hook bodies dynamically into `.git/hooks`.
- Keep the setup command discoverable and repeatable so a fresh clone can enable the hook with a single documented step.
