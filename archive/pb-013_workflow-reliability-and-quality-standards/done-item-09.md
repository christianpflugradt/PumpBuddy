# Plan-item artifacts point to execution-state files that no longer exist

## Summary

Every retained `plan-item-*.md` file still identifies a corresponding `open-item-*.md` file as its item reference, but those `open-item` files are no longer present because the plan has already advanced all items to `done`.

## Evidence

- `agent/execution/plan-item-01.md:5`, `agent/execution/plan-item-02.md:5`, `agent/execution/plan-item-03.md:5`, `agent/execution/plan-item-04.md:5`, `agent/execution/plan-item-05.md:5`, `agent/execution/plan-item-06.md:5`, and `agent/execution/plan-item-07.md:5` each reference `agent/execution/open-item-XX.md`
- the current `agent/execution/` directory contains only `done-item-*.md` and `plan-item-*.md`; there are no `open-item-*.md` files

## Goal

Make the retained planning artifacts self-consistent so their item references reflect the current execution history instead of pointing at missing files.

## Scope

- decide on the repository’s intended meaning for `## Item Reference` in retained `plan-item` artifacts after an item changes state
- update the existing `plan-item-*.md` files or the planning template so the references point at a real current-state artifact or use wording that does not imply a file must still exist
- keep the fix limited to execution-artifact consistency; do not rewrite accepted implementation or review content

## Acceptance Criteria

- no retained `plan-item-*.md` file references a missing `agent/execution/open-item-*.md` path
- the repository’s chosen `plan-item` reference style is applied consistently across the current execution set
- future item planning artifacts avoid introducing references that become broken immediately after state transitions

## References

- `agent/execution/plan-item-01.md`
- `agent/execution/plan-item-02.md`
- `agent/execution/plan-item-03.md`
- `agent/execution/plan-item-04.md`
- `agent/execution/plan-item-05.md`
- `agent/execution/plan-item-06.md`
- `agent/execution/plan-item-07.md`
- `agent/templates/item-template.md`


## Review Acceptance

- Criteria Met: The retained `plan-item-*.md` files no longer reference missing `open-item` paths, the current execution set uses a consistent stable item-id convention, and [item-template.md](agent/templates/item-template.md) now documents that same convention for future plan files.
- Evidence: The reviewed commit updates every current [plan-item-*.md](agent/execution/plan-item-01.md) companion to `- Stable item id: \`item-XX\`` and adjusts [item-template.md](agent/templates/item-template.md) so plan references are no longer tied to transient execution-state filenames.
- Runtime/Build Check: `rg -n '^- Stable item id: \`item-[0-9]+' agent/execution/plan-item-*.md` returned all retained plan files (`plan-item-01` through `plan-item-07` and `plan-item-09` through `plan-item-15`), confirming the stable reference style is applied across the current execution set.
- Residual Risk: None identified.
