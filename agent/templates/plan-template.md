# Plan Template

## Purpose

This template defines a plan as a scope-and-outcome artifact.

A plan describes what should be achieved and under which constraints.
It does not contain execution-item level detail.

Refinement reads from the plan and creates execution items.
Refinement must not rewrite the plan.

## Plan Template

```md
# Plan: <Short Name>

## Goal

Describe the intended outcome of this plan.

## Scope

- included outcome 1
- included outcome 2

## Out of Scope

- excluded concern 1
- excluded concern 2

## Success Criteria

- measurable criterion 1
- measurable criterion 2

## Constraints

- constraint 1
- constraint 2

## Inputs

- `path/to/relevant/document.md`
- `path/to/another/relevant/document.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
```

## Usage Guidance

- Keep plans concise and outcome-oriented.
- Keep item-level implementation details out of the plan.
- Update plans only through explicit plan-editing steps.
