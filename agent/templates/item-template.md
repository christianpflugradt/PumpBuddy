# Item Template

## Purpose

This template defines the standard structure for execution items in this project.

It is intended for:

- refinement when creating new items
- implementation when executing items
- review when validating completed items
- automation scripts that extract structured information

The template is intentionally lightweight.

It must provide enough structure for reliable AI-agent execution without turning each item into heavy process overhead.

## Template Rules

### Core fields

The following fields should normally be present in every execution item:

- Goal
- Scope
- Acceptance Criteria
- References

These fields are considered the minimum useful structure.

### Optional fields

The following fields may be added when they provide clear value:

- Assumptions
- Out of Scope
- Dependencies
- Notes for Review

Do not add optional fields unless they materially improve execution or review quality.

### Authoring rules

Execution items should follow these rules:

- describe one bounded piece of work
- be small enough to implement and review in one step
- avoid combining unrelated concerns
- reference existing strategy or design documents instead of duplicating them
- prefer concrete acceptance criteria over vague intent
- avoid hidden requirements not expressed in the item or its references

### State handling

Item state is not stored inside the file body.

Item state is encoded in the filename, for example:

- `open-item-0001.md`
- `review-item-0001.md`
- `done-item-0001.md`

The content of the file should remain stable across state transitions unless the work itself changes.

Optional planning companion:

- a plan may be stored in a separate companion file next to the item
- naming convention: `plan-item-<id>.md` for `open-item-<id>.md`
- the plan file does not change name when the related item moves across states

---

# Template

```md
# Item Title

## Goal

Describe the specific outcome this item should achieve.

## Scope

List the concrete work included in this item.

- included work 1
- included work 2

## Acceptance Criteria

Define the observable conditions that must be true for the item to be considered complete.

- criterion 1
- criterion 2

## References

List only the documents directly needed for this item.

- `path/to/document.md`
- `path/to/another-document.md`

## Assumptions

Optional.
Record bounded assumptions only when they are necessary for execution.

- assumption 1

## Out of Scope

Optional.
Record nearby concerns that are intentionally excluded from this item.

- excluded concern 1

## Dependencies

Optional.
Record explicit dependencies only when this item depends on another item or prerequisite.

- `item-0003`
- prerequisite description

## Notes for Review

Optional.
Add review-specific context only when it helps the reviewer check the item efficiently.

- review note 1
```

---

# Guidance for Refinement

When creating an item from this template:

- keep the title short and specific
- make the goal outcome-oriented
- keep the scope implementation-bounded
- define acceptance criteria that can be checked during review
- include only references that are actually needed
- use optional sections sparingly

If an item becomes too large or mixes concerns, split it into multiple items.

---

# Guidance for Implementation

During implementation:

- treat the Goal as the primary target
- stay within Scope
- satisfy all Acceptance Criteria
- consult only the listed References first
- expand context only if a real ambiguity blocks execution

If implementation reveals that the item is too large or ambiguous, this should be surfaced explicitly rather than silently widening scope.

---

# Guidance for Review

During review:

- check whether the Goal was actually achieved
- verify that work stayed within Scope
- verify each Acceptance Criterion explicitly
- use References to confirm architectural and behavioural alignment
- consult optional sections only when relevant
- prefer acceptance criteria that remain reviewable after `implement-item` creates a commit and moves the item to `review`
- when a diff check is needed, describe the expected committed change set or resulting file delta rather than depending on a dirty worktree

If the item is not acceptable, findings should be concrete and tied to missing criteria, violated constraints, or clear inconsistencies.

---

# Script Compatibility Guidance

Scripts should assume that:

- headings are written exactly as defined in this template
- core sections are expected to exist in most items
- optional sections may be absent
- item state is derived from the filename, not the content

If scripts extract values from items, they should do so by section heading rather than by fragile free-text assumptions.

---

# Change Notes

- 2026-03-08: Initial execution item template created for refinement, implementation, review, and automation use.
