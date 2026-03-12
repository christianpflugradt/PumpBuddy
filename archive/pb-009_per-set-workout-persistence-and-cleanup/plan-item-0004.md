# Plan: Update Workout Use-Case Documentation

## Item Reference

- `agent/execution/open-item-0004.md`

## Goal Summary

Update the current-state use-case documentation so it describes the shipped multi-set workout flow and removes any remaining active Hello World framing.

## Implementation Approach

- review `agent/design/use-cases.md` against the current workout terminology in `agent/design/domain-model.md` and `agent/design/api-contract.yaml`
- rewrite the workout use case to cover per-set progression within the same exercise, incremental persistence when advancing, and read-only completed sets after the user moves forward
- remove any active Hello World use-case language while keeping the document focused on the current workout slice and English-only copy rule
- keep the change limited to documentation unless a blocking mismatch in referenced design docs makes the update impossible

## Risks and Assumptions

- assumes the current source of truth is the shipped multi-set workout behavior reflected by the domain model, API contract, and plan references
- risk of documentation drift if `agent/design/use-cases.md` keeps older exercise-by-exercise wording that no longer matches same-exercise set progression

## Validation Plan

- run `sed -n '1,260p' agent/design/use-cases.md` and confirm the document describes multi-set execution, incremental persistence, and non-editable completed sets
- confirm the rendered content no longer presents Hello World as an active current-state use case

## Out of Scope

- changing acceptance criteria, item scope, or product behavior
- modifying backend, frontend, or API implementation
- expanding documentation beyond the current workout use-case slice

## Handoff Notes for Implementation

- prefer terminology that matches the current persisted workout model, especially `WorkoutSet`, active workout resume behavior, and English-only user-facing copy
- keep the plan lightweight and implementation-facing; document the current behavior rather than redesigning it
