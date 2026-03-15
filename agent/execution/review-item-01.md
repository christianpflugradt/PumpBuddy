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
