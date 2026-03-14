# Plan: Relax CI Quality Gate To Tests-Only

## Item Reference

- `agent/execution/open-item-23.md`

## Goal Summary

Adjust CI quality enforcement so pass/fail depends on backend and renderer test outcomes, not coverage percentage thresholds.

## Implementation Approach

- update `agent/scripts/run-quality.sh` so CI quality commands no longer invoke coverage threshold checks (`check-backend-coverage.sh` and `coverage:check`) while preserving formatting/lint/test and backend performance smoke checks
- keep the CI workflow structure in `.github/workflows/ci-quality.yml` unchanged except for any command/path adjustments needed to match the tests-only behavior
- update README wording in the Local Quality Check section to describe CI-aligned validation as tests-focused quality gates rather than coverage-threshold enforcement
- keep coverage badge publication workflows and scripts available as informational artifacts unless they currently block CI quality pass/fail

## Risks and Assumptions

- assume stakeholder intent is to remove coverage thresholds from CI pass/fail only, not to remove all coverage generation utilities from the repository
- risk of accidental regression in local quality docs if command descriptions still imply threshold gating after script updates
- risk that backend or renderer quality commands still transitively fail on coverage checks if any hidden calls remain

## Validation Plan

- run `agent/scripts/run-quality.sh backend` and confirm failure conditions come from validation/tests/performance smoke, not coverage threshold scripts
- run `agent/scripts/run-quality.sh renderer` and confirm failure conditions come from lint/tests only
- run `agent/scripts/run-quality.sh check` to verify CI-aligned sequence still executes and exits based on test-related outcomes
- if feasible, verify `.github/workflows/ci-quality.yml` still targets the same quality entrypoints without separate coverage-threshold jobs

## Out of Scope

- changing item scope to alter non-quality workflows (for example release or coverage badge publication)
- redefining test strategy or broader repository quality philosophy beyond this CI gate behavior change

## Handoff Notes for Implementation

- preserve existing CI path filters and job boundaries unless required for tests-only gating correctness
- keep changes minimal and explicit so reviewers can quickly verify that only coverage-threshold enforcement was relaxed
