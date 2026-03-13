# Plan: Refocus Test Strategy

## Item Reference

- Stable item id: `item-02`

## Goal Summary

Update the testing strategy document so it explicitly prioritizes meaningful confidence and durable test seams over threshold chasing while keeping the existing backend branch-coverage gate and PostgreSQL-backed integration expectations intact.

## Implementation Approach

- revise the testing goals and usage guidance to state that meaningful tests matter more than mechanical coverage optimization
- update the sections covering required tests and review expectations to clarify that backend branch coverage remains a hard repository signal without defining test value by itself
- strengthen the integration testing guidance so backend persistence and PostgreSQL-backed behaviour remain covered by meaningful integration tests
- keep the change limited to `agent/strategy/test-strategy.md` and align wording with the existing strategy and guardrail documents

## Risks and Assumptions

- wording changes could accidentally imply the coverage gate is optional, so the revised language must preserve it as a hard repository rule
- the plan assumes no CI or script changes are needed because the item is policy-only

## Validation Plan

- review `agent/strategy/test-strategy.md` after editing to confirm the new language preserves the item scope and acceptance criteria
- run `rg -n "meaningful|threshold|branch coverage|PostgreSQL|integration" agent/strategy/test-strategy.md` to verify the required policy points are present

## Out of Scope

- changing executable tests, CI scripts, or coverage thresholds
- revising strategy documents other than `agent/strategy/test-strategy.md`

## Handoff Notes for Implementation

- preserve the current document structure unless a small wording move improves clarity
- keep the branch-coverage statement framed as a repository gate and signal, not an optimization target
- ensure PostgreSQL-backed integration coverage is described as deliberate and meaningful rather than mechanical
