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


## Review Acceptance

- Criteria Met: `README.md` briefly documents both `make compose-up` and `make compose-reset`, explains when to use each command, and the wording matches the implemented `Makefile` targets and behavior.
- Evidence: Commit `ba3607d` adds `compose-up` and `compose-reset` targets to `Makefile` and adds the `Local Stack Commands` section to `README.md`; `rg -n "compose-up|compose-reset" README.md` returns both documentation lines.
- Runtime/Build Check: `make -n compose-up compose-reset` printed `docker compose up -d`, `docker compose down --volumes --remove-orphans`, `docker compose build --no-cache`, and `docker compose up -d --force-recreate`, matching the documented behavior.
- Residual Risk: none identified
