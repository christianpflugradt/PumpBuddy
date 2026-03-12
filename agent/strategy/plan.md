# Plan: Quality Hardening and Workflow Reliability

## Plan ID

pb-011

## Goal

Improve product and engineering quality by replacing browser-native popups with app-styled modals, making local pre-push quality checks reliably block stale or broken changes, raising backend test confidence where it is meaningfully justified, and tightening plan-management automation.

## Scope

- replace browser-native product popups with app-styled modal dialogs
- establish a reliable local quality gate before push so tests, linting, and required batch-style updates are run and stale outputs are caught early
- improve the mechanism that keeps generated or batch-updated quality artifacts current, with a cost-effective approach biased toward local prevention rather than post-push recovery
- increase backend coverage toward 80% or higher when supported by meaningful tests, or document why remaining gaps are not worth covering with low-value tests
- add plan-ID git tags for already finalized plans `pb-001` through `pb-010`
- automate plan-ID tag creation for future plan finalization flows, starting with `pb-011`
- convert execution item identifiers from four digits to two digits across templates, backlog/archive artifacts, and supporting scripts

## Out of Scope

- adding GitHub-side repair or retry automation that reacts to workflow failures after push
- inflating coverage with low-value or purely mechanical tests
- broad UI redesign beyond replacing browser-native popup usage with app-styled modal behaviour
- changing plan sizing guidance beyond the identifier-width update

## Success Criteria

- browser-native popup usage in the product is replaced by app-styled modal behaviour that matches the application UI
- the local quality gate blocks pushes when required checks or required batch-updated artifacts are stale or failing
- the chosen local workflow materially reduces avoidable red GitHub workflow runs caused by skipped local checks
- backend coverage reaches about 80% or higher through meaningful tests, or the repository contains explicit feedback describing why justified coverage remains below that level
- finalized historical plans `pb-001` through `pb-010` each have a corresponding git tag, and future plan finalization creates the matching plan tag automatically
- plan and execution item tooling consistently uses two-digit item identifiers for new and existing relevant artifacts

## Constraints

- prefer a simple, high-leverage local enforcement mechanism with good cost-benefit rather than complex automation
- keep user-facing product copy in English
- preserve the existing repository structure and agent workflow conventions unless a supporting script change is required
- coverage work must prioritize useful confidence in backend behaviour, especially around meaningful logic and integration points
- historical tagging should only target already finalized plans that are reconstructable within the current repository history

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
