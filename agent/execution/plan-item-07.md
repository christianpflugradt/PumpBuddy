# Plan: Standardize Pull-Rebase Before Push In Finalizers

## Item Reference

- `agent/execution/open-item-07.md`

## Goal Summary

Ensure finalization flows that push remote changes always run `git pull -r` before `git push`, and document this rule in agent task guidance.

## Implementation Approach

- Inspect all referenced finalization scripts to identify paths that perform `git push` and add an explicit `git pull -r` immediately before push while preserving existing sequencing and safety checks.
- Update task/finalization documentation in `agent/meta` so the pull-rebase-before-push rule is stated clearly where agents follow finalization workflow instructions.
- Verify command ordering with a repository search over `agent/scripts` and `agent/meta` for `git pull -r` and `git push` usage in updated paths.

## Risks and Assumptions

- Rebase can surface local/remote conflicts that require manual resolution; finalizers should fail clearly rather than bypassing conflicts.
- Some finalization paths may intentionally skip push in edge cases; the rule applies only to paths that do push.

## Validation Plan

- Run `rg -n "git pull -r|git push" agent/scripts agent/meta` and confirm pull-rebase appears before push in updated finalization paths.
- Execute any relevant script checks or shell validations used by this repository for finalizer script changes.

## Out of Scope

- Any git workflow changes outside agent finalization scripts and associated agent framework documentation.

## Handoff Notes for Implementation

- Keep modifications narrow to finalization flow sequencing and documentation language; do not change item scope or acceptance criteria.
- Preserve existing commit safety behavior and avoid introducing force-push or destructive git operations.
