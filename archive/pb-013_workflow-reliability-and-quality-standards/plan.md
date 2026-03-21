# Plan: Workflow Reliability and Quality Standards

## Plan ID

pb-013

## Goal

Restore reliable local Docker workflow behavior, replace committed coverage badge artifacts with CI-published badges, and raise the repository's maintainability standards by codifying stronger modularity and testing expectations before reviewing and refactoring the current codebase against those standards.

## Scope

- fix the Docker and Compose setup so `make compose-reset` works reliably again in the intended local workflow
- replace committed backend and renderer coverage badge artifacts with a GitHub Pages publication flow using the default project Pages URL and Shields endpoint badges
- update the engineering guardrails to require stronger modular structure, thinner entrypoints, and clearer separation of responsibilities in Rust and renderer TypeScript code
- update the test strategy so agents optimize for meaningful tests and maintainable test seams rather than chasing thresholds
- preserve a hard backend branch-coverage gate as a stakeholder-facing signal while keeping plan and implementation decisions metric-agnostic
- ensure backend coverage measurement continues to include meaningful integration coverage, especially for persistence behavior that is better validated against real PostgreSQL interactions
- sequence the work so documentation and standards updates happen before any review of the current codebase or structural refactoring
- review the current backend and test structure in later execution items against the updated standards and then implement targeted refactors and tests in separate follow-up items

## Out of Scope

- changing product behavior unrelated to Docker workflow reliability, badge publication, maintainability standards, or backend testability
- optimizing agents or plans toward a specific backend coverage percentage as the primary goal
- inflating coverage with low-value or purely mechanical tests
- introducing large framework changes or replacing the repository's major technology choices
- mixing standards-definition work with code review or refactoring in the same execution item

## Success Criteria

- `make compose-reset` succeeds again in the intended local Docker workflow and the failure cause is addressed in the repository rather than worked around informally
- README coverage badges no longer depend on committed generated files and instead resolve from GitHub Pages using the default project Pages URL derived from `christianpflugradt/PumpBuddy`
- local and CI quality checks no longer require a follow-up commit or rerun just because coverage badge artifacts were regenerated during the check
- `agent/strategy/engineering-guardrails.md` explicitly defines expectations for modular structure, thin entrypoints, separation of concerns, and large-file refactoring triggers for Rust and renderer TypeScript
- `agent/strategy/test-strategy.md` explicitly states that meaningful tests and maintainable test seams take priority over threshold-chasing, while the backend branch-coverage gate remains a hard repository signal
- refinement produces separate execution items for standards updates, codebase review, and implementation/refactoring work so later implementers are guided by the new standards without being biased by mixed-scope items

## Constraints

- use GitHub Pages with the default project site URL pattern `https://christianpflugradt.github.io/PumpBuddy/` for published badge JSON artifacts unless a later repository constraint requires a different publication path
- prefer Shields endpoint badges backed by Pages-hosted JSON over committed SVG badge artifacts or CI flows that require follow-up commits
- keep backend coverage gating branch-coverage-based
- preserve meaningful integration coverage for backend persistence and database-backed behavior where unit tests would be insufficient or misleading
- treat the coverage gate as a repository alarm for the stakeholder, not as the optimization target for implementation agents
- update standards documents first; review and refactoring work must happen in later separate execution items
- stay aligned with the existing tech stack, engineering guardrails, and test strategy documents except where this plan intentionally updates those standards

## Inputs

- `Makefile`
- `compose.yaml`
- `backend/Dockerfile`
- `renderer/Dockerfile`
- `README.md`
- `agent/scripts/run-quality.sh`
- `agent/scripts/prepare-pages-artifacts.sh`
- `agent/scripts/check-backend-coverage.sh`
- `renderer/scripts/run-coverage.mjs`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/tests/persistence_integration.rs`

## Likely Execution Shape

- update the engineering guardrails and test strategy documents to codify the new maintainability and testing standards
- diagnose and fix the Docker or Dockerfile regression that broke `make compose-reset`
- redesign the badge flow around GitHub Pages plus Shields endpoint JSON and remove the committed badge-artifact freshness dependency from quality checks
- review the current backend structure and test seams against the updated standards, especially the oversized `main.rs` boundary and integration-test determinism
- implement targeted refactors that create clearer module boundaries and thinner entrypoints without unnecessary architectural churn
- add or improve meaningful backend tests, including integration-backed coverage where persistence behavior is central, and then adjust the hard branch-coverage gate if the repository standard should be tightened

## Refinement Note

Refinement should derive execution items from this plan and keep standards-definition, review, and implementation work in separate items.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
