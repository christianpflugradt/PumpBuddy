# Plan: Remove Plan Tagging From Plan Finalization

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Update finalize-plan automation so plan completion no longer creates `pb-*` git tags, while preserving archive creation, next-plan bootstrap, commit, and push behavior.

## Implementation Approach

- Edit `agent/scripts/finalize-plan.sh` to remove plan-tag creation and any `pb-*` tag collision checks, leaving the rest of the finalization flow unchanged.
- Review related task wrapper and guidance docs (`agent/scripts/task-finalize-plan.sh`, `agent/strategy/plan.md`, `agent/meta/agent-setup.md`, `agent/meta/agent-tasks.md`) and remove references that imply tag creation during plan finalization.
- Keep command usage and success paths intact so `sh agent/scripts/finalize-plan.sh` still succeeds in valid finalize scenarios without producing tags.

## Risks and Assumptions

- Assume no downstream automation critically depends on `pb-*` tags being created during plan finalization.
- Risk of removing tag checks too broadly and affecting unrelated tag behavior; limit edits to plan-tag specific logic only.

## Validation Plan

- Execute `sh agent/scripts/finalize-plan.sh` in a valid finalization scenario and confirm completion without new `pb-*` tags.
- Verify `agent/scripts/finalize-plan.sh` no longer contains plan-tag creation or `pb-*` collision checks.
- Confirm updated documentation and task guidance no longer instruct users/agents to expect `pb-*` tags from plan finalization.

## Out of Scope

- Changes to semantic-release triggering behavior from finalization.

## Handoff Notes for Implementation

- Preserve item scope and acceptance criteria; do not alter archive, bootstrap, commit, or push semantics beyond tag removal.
- Keep edits minimal and implementation-oriented to avoid introducing workflow drift outside this item.
