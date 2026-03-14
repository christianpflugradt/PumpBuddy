# Add OpenAPI Generation Tooling

## Goal

Provide a reproducible project command surface that generates OpenAPI models for both backend and renderer from the canonical contract.

## Scope

- add generation commands in existing project tooling (Makefile and/or package scripts) for backend and renderer model generation
- ensure the commands use `agent/design/api-contract.yaml` as the single contract input
- document command usage where developers and CI can discover it

## Acceptance Criteria

- repository contains deterministic commands for generating backend and renderer models from `agent/design/api-contract.yaml`
- running `make`- or script-based generation command(s) from a clean checkout completes successfully and produces both target outputs
- generation command documentation exists in a checked-in project file and matches the implemented command surface

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/design/api-contract.yaml`
- `Makefile`
- `renderer/package.json`
- `backend/Cargo.toml`

## Out of Scope

- changing API contract semantics in `agent/design/api-contract.yaml`
- wiring generated outputs into consuming application modules
