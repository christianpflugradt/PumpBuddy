# Document Stack Commands

## Goal

Document the new local stack Makefile commands briefly in the repository README.

## Scope

- add a short README section for `make compose-up` and `make compose-reset`
- explain when each command should be used without duplicating existing Compose verification documentation

## Acceptance Criteria

- `README.md` explains both `make compose-up` and `make compose-reset` in brief, including the intended use for each command
- the documentation remains consistent with the actual Makefile command names and behavior
- `rg -n "compose-up|compose-reset" README.md` returns the new documentation lines

## References

- `agent/strategy/plan.md`
- `README.md`
- `Makefile`

## Dependencies

- `item-04`

## Out of Scope

- changing the underlying stack automation behavior
