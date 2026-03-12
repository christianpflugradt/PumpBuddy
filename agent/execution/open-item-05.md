# Tag Finalized Historical Plans

## Goal

Create plan-ID git tags for the already finalized historical plans `pb-001` through `pb-010` where the repository history supports them.

## Scope

- identify the commits that correspond to finalized plans `pb-001` through `pb-010`
- create annotated or lightweight git tags using the exact plan IDs for the reconstructable finalized plans
- verify that each created tag resolves to the intended archived plan state

## Acceptance Criteria

- `git tag --list 'pb-0*'` includes `pb-001` through `pb-010` unless a specific plan is proven non-reconstructable from current history
- any plan in the target range that is not tagged has an explicit repository note explaining why it could not be reconstructed safely
- `git rev-parse --verify pb-001^{tag}` or `git rev-parse --verify pb-001` succeeds for each created historical plan tag
- the tagging work does not alter archived plan content

## References

- `agent/strategy/plan.md`
- `archive`
- `agent/scripts/finalize-plan.sh`

## Out of Scope

- changing historical plan documents themselves
