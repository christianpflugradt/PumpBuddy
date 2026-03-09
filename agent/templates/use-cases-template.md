# Use Cases Template

## Purpose

This document defines the relevant system interaction scenarios for a project.

It is written primarily for AI agents and human stakeholders.

Its purpose is to:

- describe how the system is used
- make user and system interaction flows explicit
- provide stable behavioural reference points for implementation and review
- keep product behaviour aligned across milestones

This document describes interaction scenarios, not implementation details.

---

# Document Usage Guidance

Use this file as a structured list of use cases.

Rules:

- each use case should be a bounded interaction scenario
- keep use cases behaviour-oriented
- do not describe technical implementation in the use case itself
- do not duplicate domain model or API details unless necessary for clarity
- remove sections that do not apply rather than leaving placeholders

If the project tracks milestone deltas explicitly, the document may separate:

- Current State
- Target State for Current Milestone

Otherwise, a single list of active use cases is sufficient.

---

# Recommended Structure

## Current State

[Optional section. Use if the project tracks the current implemented behaviour.]

## Target State for Current Milestone

[Optional section. Use if the project tracks the intended next behaviour.]

---

# Use Case Item Structure

Each use case should normally contain:

- Title
- Goal
- Trigger
- Main Flow
- Success Condition
- Constraints
- Out of Scope

The structure should remain lightweight and readable.

---

# Use Case Template

```md
## Use Case: [Short Name]

### Goal

[Describe the outcome this use case exists to achieve.]

### Trigger

[Describe what starts the use case.]

### Main Flow

1. [Step 1]
2. [Step 2]
3. [Step 3]

### Success Condition

[Describe what must be true when the use case completes successfully.]

### Constraints

- [Constraint 1]
- [Constraint 2]

### Out of Scope

- [Out-of-scope item 1]
- [Out-of-scope item 2]
```

---

# Authoring Guidance

When writing use cases:

- prefer concrete behaviour over broad product vision language
- keep the flow understandable without reading source code
- avoid embedding UI design details unless they are essential to the interaction
- avoid embedding storage, API, or infrastructure details unless they are part of the scenario itself
- split use cases when multiple unrelated goals are mixed together

---

# Change Notes

- 2026-03-09: Initial use cases template created.
