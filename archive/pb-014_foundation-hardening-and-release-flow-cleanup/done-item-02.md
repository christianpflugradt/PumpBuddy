# Enforce Non-Committed Generated Artifacts

## Goal

Make generated OpenAPI model artifacts non-committed by default while keeping regeneration deterministic for local and CI workflows.

## Scope

- update repository ignore rules so generated model output paths are excluded from version control
- ensure generation paths and cleanup/rebuild behavior remain reproducible from checked-in sources
- document the non-committed generated-artifact policy in a developer-facing project document

## Acceptance Criteria

- generated model output paths for backend and renderer are ignored by Git in repository configuration
- after generating artifacts, `git status --short` does not report generated model files as tracked changes
- documented workflow states how to regenerate required artifacts from checked-in sources for local and CI use

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `.gitignore`
- `README.md`
- `Makefile`

## Dependencies

- `item-01`

## Out of Scope

- introducing exceptions that commit generated code by default


## Review Acceptance

- Criteria Met: All item acceptance criteria are satisfied: generated backend and renderer OpenAPI output paths are ignored, post-generation status remains clean, and regeneration workflow is documented for local and CI use.
- Evidence: `.gitignore` ignores `backend/target/generated/openapi/rust/` and `renderer/dist/generated/openapi/typescript/`; `README.md` documents canonical contract and `make generate-openapi`/targeted regeneration commands plus non-committed artifact policy.
- Runtime/Build Check: Executed `make generate-openapi` (successfully regenerated backend and renderer outputs) followed by `git status --short` (no tracked changes reported).
- Residual Risk: none identified
