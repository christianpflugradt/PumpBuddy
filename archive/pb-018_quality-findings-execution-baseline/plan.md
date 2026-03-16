# Plan: Quality Findings Execution Baseline

## Plan ID

pb-018

## Goal

Resolve the agreed high-value quality findings with implementation-ready scope and acceptance clarity, while keeping deferred findings out of the next execution slice.

## Scope

- enforce user ownership on active-workout mutation writes (`workout_id + user_id`) with not-found semantics for foreign IDs
- split renderer workout controller into explicit modules for workflow orchestration, UI event routing, and persistence coordination
- split backend API transport wiring from handler implementation and relocate concentrated route tests to feature-focused modules
- enforce backend test taxonomy: unit tests isolate logic with mocked dependencies (no real DB), integration tests own real DB interaction checks
- migrate renderer unit and coverage tooling from Node test runner to Vitest as the single baseline in local and CI flows
- make release automation deterministic by using pinned, repository-managed semantic-release dependencies with lockfile control
- keep reviewed finding documents implementation-ready as backlog references for follow-up execution items

## Out of Scope

- findings explicitly removed during discussion (performance-smoke expansion, cleartext dev credentials hardening, Playwright baseline rollout)
- use-case review/adaptation and potential capabilities document work (deferred to a later discussion)
- introducing public HTTP admin surfaces for privileged maintenance actions

## Success Criteria

- all in-scope findings have corresponding implementation items after refinement with clear acceptance criteria and no unresolved direction decisions
- active-workout ownership boundary is enforced on write paths and validated by tests for cross-user mutation attempts
- renderer and backend layering refactors preserve existing workout behavior while reducing monolithic control surfaces
- backend test suites follow agreed boundaries (unit isolated/no DB, integration DB-focused and selective for expensive edge coverage)
- renderer test/coverage and release workflows are deterministic and aligned with documented technology/tooling baselines

## Constraints

- keep changes aligned with existing architecture, security baseline, test strategy, and engineering guardrails documents
- prefer pragmatic, low-risk slicing suitable for the next 4-8 execution items
- do not re-introduce removed/deferred findings into this plan slice

## Inputs

- `FINDINGS.architecture.md`
- `FINDINGS.quality.md`
- `FINDINGS.security.md`
- `FINDINGS.technology.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/security.md`
- `agent/strategy/tech-stack.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
