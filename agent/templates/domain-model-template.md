# Domain Model Template

## Purpose

This document defines the conceptual domain model of a project.

It is written primarily for AI agents and human stakeholders.

Its purpose is to:

- make domain concepts explicit
- define consistent terminology
- clarify relationships between entities
- reduce semantic drift across milestones and implementations

This document defines concepts and relationships, not persistence layout or implementation details.

---

# Document Usage Guidance

Use this file as a structured list of domain concepts.

Rules:

- define concepts in business or system terms
- keep names stable and consistent
- describe relationships explicitly
- avoid embedding database schema or API endpoint design here
- remove sections that do not apply rather than leaving placeholders

If the project tracks milestone deltas explicitly, the document may separate:

- Current State
- Target State for Current Milestone

Otherwise, a single active domain model is sufficient.

---

# Recommended Structure

## Current State

[Optional section. Use if the project tracks the current implemented model.]

## Target State for Current Milestone

[Optional section. Use if the project tracks the intended next model.]

---

# Domain Concept Item Structure

Each concept should normally contain:

- Name
- Description
- Attributes
- Relationships
- Constraints
- Notes

The structure should remain lightweight and concept-oriented.

---

# Domain Concept Template

```md
## Entity: [Name]

### Description

[Describe what this concept represents.]

### Attributes

- `[attribute-name]`: [type or meaning]
- `[attribute-name]`: [type or meaning]

### Relationships

- [Relationship to another entity]
- [Relationship to another entity]

### Constraints

- [Constraint 1]
- [Constraint 2]

### Notes

- [Optional note]
```

---

# Relationship Guidance

Relationships should be described at a conceptual level.

Good examples:

- A workout plan contains multiple exercises.
- A workout session belongs to one user.
- A token may be associated with one user.

Avoid turning this document into:

- a database migration plan
- a table schema listing
- a transport model for APIs

Those belong elsewhere.

---

# Authoring Guidance

When writing the domain model:

- prefer concepts that are stable across implementation changes
- keep terminology consistent with use cases and APIs
- introduce temporary concepts only when they are explicitly milestone-scoped
- distinguish between core long-lived concepts and temporary bootstrap concepts when needed
- split concepts rather than overloading a single entity with multiple meanings

---

# Change Notes

- 2026-03-09: Initial domain model template created.
