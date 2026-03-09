# Capabilities Template

## Purpose

This document defines the system capabilities of a project.

It is optional and is most useful when the product grows beyond a very small number of use cases.

It is written primarily for AI agents and human stakeholders.

Its purpose is to:

- describe what the system must be able to do at a higher level
- group related behaviour without going into implementation details
- provide a stable product-level reference above individual use cases

This document defines capabilities, not UI flows, implementation details, or milestone tasks.

---

# When to Use This Document

Use this document when:

- the project has multiple functional areas
- use cases alone no longer provide a clear high-level overview
- the product roadmap benefits from a stable capability layer

This document may be omitted in very small or early-stage projects.

---

# Document Usage Guidance

Use this file as a structured list of capabilities.

Rules:

- each capability should describe a meaningful system ability
- capabilities should remain higher-level than use cases
- do not describe technical implementation here
- do not duplicate milestones or execution tasks
- remove sections that do not apply rather than leaving placeholders

If the project tracks milestone deltas explicitly, the document may separate:

- Current State
- Target State for Current Milestone

Otherwise, a single active capability list is sufficient.

---

# Recommended Structure

## Current State

[Optional section. Use if the project tracks the current implemented abilities.]

## Target State for Current Milestone

[Optional section. Use if the project tracks the intended next abilities.]

---

# Capability Item Structure

Each capability should normally contain:

- Name
- Description
- Included Behaviour
- Constraints
- Out of Scope

The structure should remain lightweight and product-oriented.

---

# Capability Template

```md
## Capability: [Name]

### Description

[Describe the ability the system provides.]

### Included Behaviour

- [Behaviour 1]
- [Behaviour 2]

### Constraints

- [Constraint 1]
- [Constraint 2]

### Out of Scope

- [Out-of-scope item 1]
- [Out-of-scope item 2]
```

---

# Authoring Guidance

When writing capabilities:

- keep them broader than individual use cases
- keep them narrower than vague product vision
- use them to group related functional behaviour
- avoid technical wording unless the capability itself is technical in nature
- avoid creating a capability for every tiny feature

A capability should typically map to multiple related use cases once the system grows.

---

# Change Notes

- 2026-03-09: Initial capabilities template created.
