# Active plan still references the removed badge-artifact check script

## Summary

The active plan still lists `agent/scripts/check-quality-artifacts.sh` as a current input even though the badge-flow implementation removed that script from the repository.

## Evidence

- `agent/strategy/plan.md:49-64` still includes `agent/scripts/check-quality-artifacts.sh` under `## Inputs`
- `agent/scripts/check-quality-artifacts.sh` does not exist in the current repository state
- `agent/execution/done-item-04.md:48-53` records the accepted implementation state as the removal of the committed badge-artifact freshness check in favor of the Pages-based flow

## Goal

Bring the active plan document back into sync with the implemented badge-publication workflow so the plan no longer describes deleted repository inputs.

## Scope

- update `agent/strategy/plan.md` to remove or replace the stale `agent/scripts/check-quality-artifacts.sh` input
- keep the plan wording aligned with the accepted Pages-based badge flow and current quality scripts
- do not reopen the badge-flow implementation itself unless another inconsistency is discovered while updating the plan

## Acceptance Criteria

- `agent/strategy/plan.md` no longer references `agent/scripts/check-quality-artifacts.sh`
- the plan inputs and badge-related execution shape point only at repository files that exist in the current implementation state
- the updated plan still reflects the accepted item-04 outcome of Pages-hosted badge publication without committed badge-artifact freshness checks

## References

- `agent/strategy/plan.md`
- `agent/execution/done-item-04.md`
- `agent/scripts/run-quality.sh`
- `agent/scripts/prepare-pages-artifacts.sh`
