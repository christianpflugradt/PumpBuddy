# Plan Item Template

## Purpose

This template defines a lightweight implementation plan for one execution item.

A plan is optional.
If present, it guides implementation but does not replace the item definition.

## Naming Convention

Plan files should be stored next to the related execution item using:

- `plan-item-01.md` for `open-item-01.md`

Plan file names remain stable across item state transitions.

## Template

```md
# Plan: <item title>

## Item Reference

- `agent/execution/.../open-item-01.md`

## Goal Summary

Briefly restate the intended outcome of the item.

## Implementation Approach

- planned change 1
- planned change 2

## Risks and Assumptions

- risk or assumption 1

## Validation Plan

- test or check 1
- test or check 2

## Out of Scope

- excluded concern 1

## Handoff Notes for Implementation

- constraints or execution notes
```

## Usage Notes

- Keep plans short and practical.
- Do not redefine item scope or acceptance criteria.
- If implementation diverges from the plan, note why in implementation output.
