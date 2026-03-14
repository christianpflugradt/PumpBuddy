# Remove Plan Tagging From Plan Finalization

## Goal

Stop creating `pb-00x` git tags during plan finalization while preserving the rest of the archive workflow.

## Scope

- remove plan-tag creation and related tag-collision checks from finalize-plan automation
- keep archive creation, next-plan bootstrap, commit, and push behavior intact
- align affected documentation or script guidance with the new no-tag finalization behavior

## Acceptance Criteria

- `agent/scripts/finalize-plan.sh` no longer creates annotated plan tags or checks for existing `pb-*` tags
- executing `sh agent/scripts/finalize-plan.sh` in a valid finalize scenario succeeds without creating a new plan tag
- finalization documentation does not instruct agents/users to expect `pb-*` tags from plan completion

## References

- `agent/strategy/plan.md`
- `agent/scripts/finalize-plan.sh`
- `agent/scripts/task-finalize-plan.sh`
- `agent/meta/agent-setup.md`
- `agent/meta/agent-tasks.md`

## Out of Scope

- semantic-release triggering behavior from finalization
