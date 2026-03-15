# Align Makefile Command Language

## Goal

Expose the agreed product-oriented Makefile command names and remove superseded target names.

## Scope

- rename existing Makefile targets to `run-app`, `stop-app`, `rebuild-app`, `setup-dev`, `refresh-api-clients`, `refresh-backend-api-client`, and `refresh-frontend-api-client`
- keep `check` unchanged
- remove old target names without adding compatibility aliases

## Acceptance Criteria

- `Makefile` defines the agreed command names exactly and includes `stop-app` mapped to Docker Compose stop behavior
- legacy renamed targets are no longer present as callable Makefile targets
- running `make -n run-app stop-app rebuild-app setup-dev refresh-api-clients refresh-backend-api-client refresh-frontend-api-client check` succeeds

## References

- `agent/strategy/plan.md`
- `Makefile`

## Notes for Review

- verify command names match plan success criteria exactly


## Review Acceptance

- Criteria Met: Makefile defines `run-app`, `stop-app`, `rebuild-app`, `setup-dev`, `refresh-api-clients`, `refresh-backend-api-client`, `refresh-frontend-api-client`, and `check`; `stop-app` runs Docker Compose stop behavior; legacy renamed targets are absent.
- Evidence: `Makefile` `.PHONY` and targets include only the agreed command names with `stop-app: docker compose stop`; no legacy targets are declared as callable entries.
- Runtime/Build Check: Ran `make -n run-app stop-app rebuild-app setup-dev refresh-api-clients refresh-backend-api-client refresh-frontend-api-client check` and it completed successfully with expected dry-run commands for each target.
- Residual Risk: none identified
