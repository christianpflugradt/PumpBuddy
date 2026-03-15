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


## Review Acceptance

- Criteria Met: All acceptance criteria in `agent/execution/review-item-04.md` are satisfied; `agent/scripts/finalize-plan.sh` no longer checks existing `pb-*` tags or creates annotated plan tags, and finalization guidance remains aligned with a no-tag flow.
- Evidence: Commit `cc23a1d` removes the tag collision guard and deletes `git tag -a "${PLAN_ID}" ...` plus `git push --follow-tags`, replacing push behavior with plain `git push`; current `agent/scripts/finalize-plan.sh` contains no `git tag` command and no `refs/tags` check, and `agent/scripts/task-finalize-plan.sh`, `agent/meta/agent-setup.md`, and `agent/meta/agent-tasks.md` do not instruct plan-tag expectations.
- Runtime/Build Check: Executed `TEST_DIR="$(mktemp -d /tmp/pb-review-04.XXXXXX)" && REMOTE_DIR="$(mktemp -d /tmp/pb-review-04-remote.XXXXXX)" && ... && sh agent/scripts/finalize-plan.sh` in isolated fixture repo; observed `STATUS=0`, `BEFORE_TAGS=0`, `AFTER_TAGS=0`, successful archive/commit/push output, and no plan tag created.
- Residual Risk: none identified.
