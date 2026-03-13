# Plan: Plan-item artifacts point to execution-state files that no longer exist

## Item Reference

- `agent/execution/open-item-09.md`

## Goal Summary

Make retained `plan-item` artifacts self-consistent by replacing broken execution-item references with a reference style that still makes sense after item state transitions, and align the planning template so future plans do not immediately go stale.

## Implementation Approach

- Inspect the existing `plan-item-*.md` files and choose a single reference style that matches the repository's intended execution history semantics without implying that a transient `open-item` path must still exist.
- Update the retained `plan-item-*.md` files to use that chosen reference style consistently across the current execution set.
- Update the planning template or related execution guidance so newly created plan files follow the same stable reference convention.

## Risks and Assumptions

- The fix should preserve the meaning of `## Item Reference` while avoiding wording that becomes false once an item moves to `done` or another state.
- Existing completed plan content should remain intact apart from the minimal reference-style adjustments needed for consistency.
- If the repository prefers a conceptual item identifier over a live file path, that convention should be expressed clearly enough for future automation and manual authoring.

## Validation Plan

- Run `rg -n "agent/execution/open-item-" agent/execution/plan-item-*.md` and confirm no retained plan file still points at a missing `open-item` path.
- Review the updated plan template and current plan files to confirm the chosen reference style is applied consistently.
- Check that the change stays limited to execution-artifact consistency and does not alter accepted implementation or review content.

## Out of Scope

- Rewriting completed implementation or review narratives beyond the minimal reference updates.
- Changing execution item scope, acceptance criteria, or workflow state semantics outside the plan-reference issue.
- Broad automation refactors unless a small template or guidance change is necessary to prevent recurrence.

## Handoff Notes for Implementation

- Prefer the smallest durable convention change that fixes both the current retained plan files and future plan creation.
- Keep any wording changes explicit enough that reviewers can tell whether `Item Reference` points to a current file, a stable item identifier, or a historical companion artifact.
