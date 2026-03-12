# Plan: Document Stack Commands

## Item Reference

- `agent/execution/open-item-05.md`

## Goal Summary

Add brief README guidance for `make compose-up` and `make compose-reset` that matches the current Makefile behavior and complements the existing Compose verification section.

## Implementation Approach

- Inspect `Makefile` and `README.md` to anchor the wording to the real command names and current documentation structure.
- Add a short README section near the existing local developer commands that explains when to use `make compose-up` versus `make compose-reset`.
- Keep the wording concise and refer readers to the existing Compose runtime verification section rather than duplicating detailed verification steps.

## Risks and Assumptions

- The README should not imply `make compose-up` performs a build, because the Makefile currently starts the stack without `--build`.
- The new section should stay aligned with the current command implementations; if the Makefile changes later, the README will need a matching update.

## Validation Plan

- Re-read the edited README section against `Makefile` to confirm the command descriptions are accurate.
- Run `rg -n "compose-up|compose-reset" README.md` to verify the required documentation lines exist.

## Out of Scope

- Changing the behavior of the Makefile targets.
- Reworking the existing Compose verification instructions.

## Handoff Notes for Implementation

- Treat this as a documentation-only change; additional tests are not required unless the scope expands beyond README updates.
