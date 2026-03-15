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


## Review Acceptance

- Criteria Met: Renovate compatibility is explicitly preserved by adding a regex custom manager for `OPENAPI_GENERATOR_IMAGE` in `Makefile`; `renovate.json` schema validation passes; and a concrete verification confirms generation tooling additions keep Renovate update targets discoverable.
- Evidence: Commit `b7da26a` adds `customManagers` in `renovate.json` with `managerFilePatterns` for `Makefile`, `matchStrings` for `OPENAPI_GENERATOR_IMAGE ?= <image>:<tag>`, and `datasourceTemplate: docker`; this directly covers the new generation image pin introduced by the OpenAPI workflow.
- Runtime/Build Check: Executed `npx --yes --package renovate renovate-config-validator renovate.json` and observed `Config validated successfully`; executed `node -e "const fs=require('fs'); const cfg=JSON.parse(fs.readFileSync('renovate.json','utf8')); const mk=fs.readFileSync('Makefile','utf8'); const m=cfg.customManagers?.[0]?.matchStrings?.[0]; const re=new RegExp(m); const hit=mk.match(re); if(!hit?.groups){console.error('No match'); process.exit(1);} console.log('depName='+hit.groups.depName); console.log('currentValue='+hit.groups.currentValue);"` and observed `depName=openapitools/openapi-generator-cli` and `currentValue=v7.16.0`.
- Residual Risk: low; regex manager coverage is currently limited to the OpenAPI generator image in `Makefile`, which matches this item's scoped compatibility objective.
