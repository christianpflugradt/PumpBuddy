# Standardize Pull-Rebase Before Push In Finalizers

## Goal

Document and enforce a `git pull -r` before `git push` rule in agent task finalization scripts to reduce non-fast-forward failures.

## Scope

- update relevant finalization scripts to perform pull-rebase before push where remote updates are expected
- align agent framework documentation with the pull-rebase-before-push rule
- keep existing commit sequencing and safety checks intact

## Acceptance Criteria

- task finalization scripts that push to remote include an explicit `git pull -r` step before `git push`
- agent documentation covering task/finalization workflow states the pull-rebase-before-push rule
- `rg -n "git pull -r|git push" agent/scripts agent/meta` shows pull-rebase usage preceding push in the updated finalization paths

## References

- `agent/strategy/plan.md`
- `agent/scripts/finalize-refine-plan.sh`
- `agent/scripts/finalize-plan-item.sh`
- `agent/scripts/finalize-implement-item.sh`
- `agent/scripts/finalize-review-accept-item.sh`
- `agent/scripts/finalize-plan.sh`
- `agent/meta/agent-setup.md`
- `agent/meta/agent-tasks.md`

## Out of Scope

- changing git strategy outside agent finalization flows
