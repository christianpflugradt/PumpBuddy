# Keep Renovate Compatible With Generation Workflow

## Goal

Ensure Renovate dependency updates remain functional after introducing OpenAPI generation tooling and generated-output ignore rules.

## Scope

- review current Renovate configuration against new generation commands and output paths
- add minimal Renovate configuration only if required to preserve intended dependency update behavior
- verify Renovate-relevant files and dependency surfaces remain discoverable and updatable

## Acceptance Criteria

- Renovate configuration either remains unchanged with explicit compatibility confirmation or is updated with a documented rationale
- `renovate.json` (and any added Renovate config file) passes schema validation
- a concrete verification step confirms generation tooling additions do not hide or block dependency update targets for Renovate

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `renovate.json`
- `Makefile`
- `renderer/package.json`
- `backend/Cargo.toml`

## Dependencies

- `item-01`
- `item-02`

## Out of Scope

- broad Renovate policy redesign unrelated to generation workflow compatibility
