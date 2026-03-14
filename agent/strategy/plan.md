# Plan: Foundation Hardening and Release Flow Cleanup

## Plan ID

pb-014

## Goal

Strengthen project foundations around contract-driven code generation, release automation, CI efficiency, and dependency hygiene while capturing a mobile-first UX review for a follow-up plan.

## Scope

- generate OpenAPI-based models for both renderer and backend, treat generated models as non-committed artifacts, and add reproducible generation commands in the appropriate project tooling (for example Makefile/package scripts)
- ensure generated-model workflows remain compatible with Renovate dependency management, adding Renovate configuration only if required
- remove plan-completion tag creation (`pb-00x` tags) and remove scheduled semantic-release runs
- trigger semantic-release from successful plan finalization flow after finalize commit and push completes (via GitHub CLI workflow trigger)
- document and enforce a general agent workflow rule to run `git pull -r` before `git push` in task finalization flows
- address Renovate-reported abandoned GitHub Actions dependencies (`actions/configure-pages` and `actions/deploy-pages`) by removing or replacing them with maintained alternatives
- produce a mobile-first UI/UX review document in the project root with concrete findings and suggested improvements, explicitly scoped as research/output for future planning

## Out of Scope

- implementing UI/UX improvements identified by the review document
- introducing `cargo-chef` or advanced CI optimization beyond standard Rust dependency caching in this plan

## Success Criteria

- renderer and backend consume generated OpenAPI models from reproducible commands, generated artifacts are not committed, and CI/build workflows can regenerate them deterministically
- Renovate continues to function for dependency updates with the new generation workflow (or required Renovate adjustments are implemented and verified)
- plan finalization no longer creates `pb-00x` tags, scheduled semantic-release automation is removed, and semantic-release is triggerable from successful finalize flow
- task automation documentation reflects a standard `git pull -r` before `git push` sequence for agent-driven finalization to reduce non-fast-forward push failures
- deprecated/abandoned Pages actions are removed or replaced with maintained equivalents and workflows remain valid
- a project-root UI/UX review document exists with mobile-first findings and concrete recommended improvements for a future plan
- backend CI includes standard Cargo dependency caching with measurable improvement versus current baseline runtime

## Constraints

- keep OpenAPI YAML as the canonical API source of truth and avoid manual edits to generated code
- generated artifacts remain non-committed by default and must be reproducible from checked-in sources and documented commands
- preserve existing security/trust boundaries and avoid introducing release flow changes that require elevated manual secrets handling beyond current GitHub Actions/GitHub CLI patterns
- keep CI optimization to common-practice, low-complexity caching (`rust-cache`) in this plan

## Inputs

- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
