# Plan: CI Quality and Weekly Release Automation

## Plan ID

pb-005

## Goal

Establish reliable, path-aware quality automation for backend and frontend changes, plus weekly semantic release automation with clear versioning and release-note rules.

## Scope

- GitHub Actions workflow(s) that run backend quality checks only when backend-relevant files change.
- GitHub Actions workflow(s) that run frontend/renderer quality checks only when frontend-relevant files change.
- Backend quality baseline in CI (at least Rust unit tests and linting).
- Frontend/renderer quality baseline in CI (tests and linting for TypeScript renderer).
- Pragmatic workflow design decision: one combined workflow with conditional jobs or two separate workflows, whichever is simpler and maintainable.
- Semantic Release integration with a weekly night schedule from Sunday to Monday, running only when relevant commits exist.
- Conventional commit mapping for releases: `BREAKING CHANGE` -> major, `feat` -> minor, `fix`/`perf`/`chore` -> patch.
- Release notes policy that excludes docs-only changes.
- README badges for license and CI status.

## Out of Scope

- Test coverage measurement and coverage badges.
- Non-quality product feature work unrelated to CI/release automation.

## Success Criteria

- Pull requests that modify only backend-relevant files trigger backend CI checks and do not trigger unrelated frontend checks.
- Pull requests that modify only frontend/renderer-relevant files trigger frontend CI checks and do not trigger unrelated backend checks.
- CI pipelines enforce at least lint + test gates for both backend and frontend paths.
- A scheduled weekly semantic release job is configured for the Sunday-to-Monday night window and produces releases only when qualifying commits are present.
- Version bumps follow the agreed mapping (`BREAKING CHANGE` major, `feat` minor, `fix`/`perf`/`chore` patch).
- Generated release notes exclude docs-only changes.
- README displays working license and CI badges.

## Constraints

- Keep execution items small and independently deliverable during refinement.
- Favor maintainable, straightforward workflow structure over over-engineering.
- Do not include coverage implementation in this plan; reserve it for a follow-up plan.

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
