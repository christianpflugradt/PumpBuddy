# Plan: Tag Finalized Historical Plans

## Item Reference

- `agent/execution/open-item-05.md`

## Goal Summary

Create plan-ID git tags for finalized archived plans `pb-001` through `pb-010` when the repository history makes the intended archive state reconstructable, and record any exceptions explicitly.

## Implementation Approach

- Inspect `archive/` plan folders and archived `plan.md` files for `pb-001` through `pb-010` to confirm the exact target plan IDs and expected archived states.
- Use git history around each archived plan finalization to identify the commit that safely represents the finalized plan state without modifying archived content.
- Create the missing `pb-001` through `pb-010` tags at the verified commits, keeping the tag naming exact and avoiding retagging unless the existing ref is already correct.
- Add a repository note for any plan in that range that cannot be reconstructed safely from current history, with the reason and the attempted evidence source.

## Risks and Assumptions

- Historical plan finalization may not map one-to-one to an obvious commit for every archived plan, especially if archive moves and follow-up fixes were interleaved.
- Existing tags in the target range, if any, must be validated before reuse so the work does not silently preserve an incorrect historical reference.
- The implementation assumes repository-local documentation is an acceptable place for any required non-reconstructable-plan note.

## Validation Plan

- Run `git tag --list 'pb-0*'` and confirm the output includes each reconstructable tag from `pb-001` through `pb-010`.
- Run `git rev-parse --verify <plan-id>^{tag}` or `git rev-parse --verify <plan-id>` for each created or confirmed tag.
- Compare each tagged commit against the corresponding archived plan directory enough to confirm the tag resolves to the intended finalized plan state.
- Verify no archived plan content changed as part of the tagging work.

## Out of Scope

- Changing archived plan documents or altering plan acceptance criteria.
- Extending future finalize-plan automation; that belongs to the separate automation item.

## Handoff Notes for Implementation

- Prefer a deterministic evidence trail per tag so later review can see why a commit was chosen.
- If a repository note is needed, keep it narrow and place it where future historical-tag maintenance can find it easily.
