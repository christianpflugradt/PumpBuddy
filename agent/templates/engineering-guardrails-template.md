# Engineering Guardrails Template

## Purpose

This document defines the engineering guardrails for a project.

It is written primarily for AI agents participating in development, but it should also remain readable for human stakeholders.

Its purpose is to:

- define implementation rules that must be preserved across tasks
- reduce unnecessary architectural and implementation drift
- make recurring engineering decisions deterministic
- provide implementation and review agents with stable constraints

This document defines engineering rules, not product requirements.

---

# Authority and Scope

This document is authoritative for recurring engineering decisions unless the human stakeholder explicitly changes it.

It applies primarily to:

- implementation tasks
- architecture-sensitive reviews
- consistency reviews
- technology reviews

It may also be relevant during plan refinement when execution items depend on engineering constraints.

This document should not be used to describe:

- product capabilities
- use cases
- plan goals
- domain behaviour
- API semantics except where engineering rules constrain them

---

# Change Policy

This document should evolve slowly.

Update it when:

- a recurring engineering rule changes
- a new implementation invariant must be preserved
- an earlier rule proved too weak, too broad, or incorrect

Changes should be accompanied by a short rationale in the change notes.

---

# Usage Guidance for AI Agents

AI agents should treat this document as a constraint document.

Agents must:

- follow these guardrails by default
- avoid silent deviations
- raise explicit findings when an item conflicts with a guardrail
- prefer conservative implementation choices when the document leaves room for interpretation

If a task requires a justified exception, the exception should be explicit and documented.

---

# Template Usage Guidance

Use only the sections relevant to the project.

Rules:

- omit sections that do not apply
- do not leave placeholder sections empty
- keep the document specific enough to guide implementation
- avoid turning the document into a full architecture description

The goal is to define stable engineering rules, not to duplicate the entire system design.

---

# Recommended Core Sections

The following sections are commonly useful in many projects.

## Repository and Structure Rules

Purpose:

Define structural conventions that should remain stable across the repository.

May contain:

- top-level directory expectations
- separation between source, tests, generated artifacts, and temporary files
- where project documentation belongs
- where agent framework files belong

May exclude:

- detailed module-level architecture
- product-specific behaviour

---

## Dependency Rules

Purpose:

Define how dependencies should be selected and introduced.

May contain:

- preference for mature and well-supported libraries
- restrictions on introducing niche or weakly maintained packages
- expectations for dependency minimization
- compatibility with dependency automation tooling

May exclude:

- exact dependency versions unless strategically necessary

---

## Configuration Rules

Purpose:

Define how application configuration should be handled.

May contain:

- environment-based configuration expectations
- separation of configuration from code
- runtime injection rules
- restrictions on hardcoded configuration

May exclude:

- secret management details if they are covered by security documents

---

## Error Handling Rules

Purpose:

Define expectations for error handling and failure behaviour.

May contain:

- preference for explicit error handling
- requirements for predictable failure modes
- restrictions on silent failure or swallowed errors
- expectations for actionable error messages

May exclude:

- product-specific validation logic

---

## Logging Rules

Purpose:

Define how logging should be approached.

May contain:

- expectations for useful operational logs
- restrictions on logging secrets or sensitive values
- consistency requirements for structured or leveled logging

May exclude:

- full observability architecture unless relevant

---

# Optional Sections

Add these sections only when they are relevant to the project.

## Code Generation Rules

Purpose:

Define expectations around generated code.

May contain:

- whether generated code is committed
- whether generation is part of build or CI
- restrictions on manual edits to generated files
- authority of generated artifacts relative to source definitions

Use this section if the project relies on OpenAPI generation, schema generation, codegen pipelines, or similar mechanisms.

---

## Persistence and Database Access Rules

Purpose:

Define how persistence should be approached.

May contain:

- database access constraints
- explicit SQL vs ORM policy
- migration handling expectations
- separation between domain logic and persistence logic

Use this section only when the project has persistence concerns.

---

## API Implementation Rules

Purpose:

Define engineering constraints for implementing APIs.

May contain:

- adherence to a canonical contract
- validation responsibilities
- serialization conventions
- backward compatibility expectations where relevant

Use this section only when the project exposes APIs.

---

## Runtime and Container Rules

Purpose:

Define engineering constraints related to runtime packaging and containerization.

May contain:

- container boundary expectations
- service exposure rules
- separation between public and internal services
- runtime assumptions relevant to implementation

Use this section when the project uses containers or defined runtime topology.

---

## Migration and Data Evolution Rules

Purpose:

Define how schema or persisted-data changes should be handled.

May contain:

- migration expectations
- backward compatibility constraints
- rollout safety expectations
- data evolution principles

Use this section when data shape changes over time.

---

## Temporary Files and Generated Artifacts Rules

Purpose:

Define handling of temporary files and generated outputs.

May contain:

- which temporary directories may exist
- what must remain ignored by Git
- which placeholder files may be committed
- expectations for cleanup or reproducibility

Use this section when the project uses temp directories, generated artifacts, or scripted workflows.

---

## Commit and Versioning Rules

Purpose:

Define repository-level change recording rules.

May contain:

- commit message conventions
- semantic versioning expectations
- rules for changelog or release tooling
- when multi-line commit messages are preferred

Use this section when the project has explicit commit or release conventions.

---

# Section Authoring Pattern

When writing project-specific guardrails, each section should ideally answer:

1. What is the purpose of this rule area?
2. What must agents preserve?
3. What is explicitly allowed?
4. What is explicitly disallowed?
5. What is intentionally left flexible?

This pattern helps keep the document precise without making it unnecessarily long.

---

# Example Skeleton

The following skeleton may be used as a starting point for a project-specific engineering guardrails document.

```md
# Engineering Guardrails

## Purpose

[Describe the purpose of the document.]

## Authority and Scope

[Describe when the document applies.]

## Change Policy

[Describe how and when this document should change.]

## Usage Guidance for AI Agents

[Describe how agents should use this document.]

## Repository and Structure Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Dependency Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Configuration Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Error Handling Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Logging Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Code Generation Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Persistence and Database Access Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Runtime and Container Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Commit and Versioning Rules

Purpose:
[...]
Rules:
- [...]
- [...]

## Change Notes

- YYYY-MM-DD: Initial project-specific guardrails defined.
```

---

# Change Notes

- 2026-03-08: Initial engineering guardrails template created.
