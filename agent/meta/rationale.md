# AI Agent Development Rationale

## Purpose of this Document

This document defines the conceptual and operational foundation for organizing software development with AI agents.

It does not describe a specific product. Instead, it explains how a project can be structured so that AI agents can participate in development in a deterministic, efficient, and maintainable way.

The document allows an AI assistant to reconstruct the development framework of a project, including:

- documentation structure
- execution workflow
- agent interaction model
- automation scripts
- operational conventions

This document is meta-documentation about the development system itself.

Operational agents should not load this document during normal execution. It is only used when creating or evolving the AI development framework.

---

# Design Principles

## Minimal Context

AI agents should optimize for first-pass correctness with minimal unnecessary context.

Principles:

- load only context likely required to complete the item correctly on first attempt
- prefer slightly more context when it significantly reduces rework risk
- avoid loading broad reference documents unless the item explicitly depends on them
- do not optimize token reduction at the cost of requirement fidelity

Operational rule:

- token efficiency is measured by total cost to completion (implementation and revisions), not by single-run input size
- if additional context is expected to prevent substantial rework, loading it is preferred
- if additional context is unlikely to change decisions materially, do not load it

Context loading strategy:

1. start with the execution item and required guardrails
2. add only directly referenced strategy and design files
3. add extra documents only when a concrete ambiguity blocks implementation
4. stop expanding context when expected improvement is marginal

Rationale:

Sustainable AI development prioritizes reliable delivery with controlled context growth, not minimal tokens per prompt.

Large meta-documents such as this rationale are intentionally excluded from operational workflows.

---

## Deterministic Workflows

Agents should not discover work through repository exploration.

Instead:

- work states are encoded in filenames
- ordering is deterministic
- scripts resolve context

This avoids ambiguity and unnecessary reasoning.

---

## Task-Only Execution with Fresh Context

The framework intentionally avoids persistent agent roles.

Reason:

- each execution starts with fresh context
- behavior is derived from the selected task
- deterministic task scripts are a stronger control mechanism than persistent role memory

Fresh context per task run is a default requirement.

It is critical when switching perspectives between tasks, for example:

- `implement-item` -> `review-item`
- `refine-plan` -> `review-consistency`

Without a fresh context, perspective leakage can cause avoidable review errors and biased decisions.

---

## Separation of Concerns

The repository separates:

- Meta (framework documentation)
- Strategy (project direction)
- Design (system description)
- Execution (operational tasks)
- Templates (task structure)
- Automation (scripts)

Each agent loads only the layers relevant for its task.

---

## Human Strategic Control

The human project owner defines:

- plans
- architectural direction
- framework evolution

AI agents assist with implementation and analysis but do not determine project direction.

---

# Documentation Framework

## Meta Layer

Location:

agent/meta/

Required files:

- rationale.md
- agent-setup.md
- agent-tasks.md

Purpose:

Defines the AI development framework itself.

Contains:

- development methodology
- interaction model
- automation rules

Excludes:

- product-specific logic
- operational tasks

---

## Strategy Layer

Location:

agent/strategy/

Required files:

- plan.md
- tech-stack.md
- engineering-guardrails.md
- test-strategy.md
- security-baseline.md
- security.md

Optional files:

- capabilities.md

Purpose:

Defines long-term project direction and constraints.

These documents provide the strategic guardrails used by refinement, implementation, and review tasks.

---

### tech-stack.md

Purpose:

Defines major technologies used in the system.

Contains:

- programming languages
- runtime services
- databases
- infrastructure components

Excludes:

- routine library selection unless strategically constrained

Detail level:

Detailed enough to constrain architecture but flexible for implementation.

---

### security-baseline.md

Purpose:

Defines the framework-level security baseline for AI-agent execution.

Contains:

- general security principles for task execution
- baseline trust and exposure rules
- baseline secret and credential handling constraints
- baseline review expectations for security-sensitive work

This file is framework-level and should remain reusable across projects.

---

### security.md

Purpose:

Defines the project-specific security architecture.

Contains:

- trust boundaries
- access separation model
- token and credential handling expectations
- exposure constraints

This file applies the baseline rules to the concrete project architecture.

Security rules must be preserved by all implementation tasks unless explicitly changed by the human stakeholder.

Agents must load both `security-baseline.md` and `security.md` when working on tasks involving:

- authentication
- tokens or secrets
- service exposure
- access control
- trust boundaries
- network interfaces

---

### capabilities.md

Purpose:

Defines what the system must be capable of doing.

Contains:

- functional capabilities
- high-level system abilities

Excludes:

- UI flows
- implementation details

Usage recommendation:

- optional for early or small projects
- recommended once use-case count or interaction complexity grows enough that use cases alone no longer provide a clear high-level product view

Operational trigger heuristic:

- introduce `capabilities.md` when at least one of these conditions becomes true:
- active use-case list is no longer quickly understandable as a product-level overview
- multiple distinct functional areas emerge and use cases start to scatter across domains
- repeated planning/review discussions need a stable abstraction layer above individual use cases

---

### plan.md

Purpose:

Defines the active implementation plan.

Contains:

- plan goal
- scope and out-of-scope
- success criteria
- constraints
- plan inputs

Excludes:

- execution tasks
- technical implementation details

---

# Design Layer

Location:

agent/design/

Required files:

- use-cases.md
- domain-model.md

Optional files:

- api-contract.yaml
- api-contract-*.yaml

---

### use-cases.md

Purpose:

Describes system interaction scenarios.

Contains:

- user workflows
- system interaction sequences

Excludes:

- technical implementation details

---

### domain-model.md

Purpose:

Defines core system concepts.

Contains:

- entities
- relationships
- terminology

Excludes:

- API endpoints
- persistence details

---

### api-contract.yaml (or api-contract-*.yaml)

Purpose:

Defines interfaces between system components in a machine-readable contract format.

Contains:

- API structures
- message formats
- interface responsibilities

Contract policy:

- machine-readable contract files are canonical
- OpenAPI YAML is the default for HTTP APIs
- alternative standards are allowed when justified by interface type (for example AsyncAPI for event interfaces, Protobuf for RPC)
- projects may maintain multiple contract files when multiple interfaces or protocols are present
- avoid duplicating canonical contract content in markdown

Optional when systems expose meaningful APIs.

---

# Execution Framework

Location:

agent/execution/

Example structure:

agent/execution/

open-item-0001.md  
plan-item-0001.md  
review-item-0002.md  
done-item-0003.md

Each file represents a single development task.

Items should be small enough to be implemented and reviewed in one step.

---

# Item State Model

States encoded in filenames:

open  
review  
done

Example:

open-item-0003.md

State transitions occur via file renaming.

Plan files are optional companion files and do not participate in state transitions.
Example: `plan-item-0001.md` remains stable while the related execution item moves across states.

---

# Templates

Location:

agent/templates/

Required files:

item-template.md
plan-item-template.md
plan-template.md

Optional files:

- api-contract-template.yaml

Purpose:

Defines structure used when creating execution items.

Lightweight template policy:

- keep templates minimal and readable
- define only a small set of core fields
- use optional fields only when they add clear value

Recommended core fields:

- goal
- scope
- acceptance-criteria
- references

Template note:

- `api-contract-template.yaml` provides a minimal valid OpenAPI starting point when a project uses an API contract.

---

# Automation Framework

Location:

scripts/

Typical scripts:

- tasks.sh
- task-refine-plan.sh
- task-plan-item.sh
- task-implement-item.sh
- task-review-item.sh
- task-review-consistency.sh
- task-review-architecture.sh
- task-review-technology.sh
- task-review-quality.sh
- task-review-security.sh
- task-finalize-plan.sh
- finalize-implement-item.sh
- finalize-plan.sh

Scripts handle deterministic operations such as:

- resolving next work item
- providing task-specific context pointers
- applying deterministic state transitions

---

# Context Resolution

Agents must not determine their working context by scanning the repository.

Instead scripts provide context.

Example:

scripts/tasks.sh implement-item

returns deterministic instructions for the selected task, including context pointers.

Security-sensitive tasks must include `agent/strategy/security-baseline.md` and `agent/strategy/security.md` when evaluating:

- authentication
- token usage
- trust boundary changes
- public exposure of services
- privileged maintenance paths

---

# Agent Interaction Model

Agents are invoked using deterministic commands.

Examples:

implement-item  
review-item  
refine-plan
finalize-plan

Commands trigger scripts that:

1. determine context
2. gather required documents
3. generate the prompt

Each invocation is executed with a fresh context window.

---

# Task Model

Tasks may include:

- plan next open item (optional)
- implement next open item
- review next review item
- review architectural consistency
- review technology adherence
- review quality posture
- review security posture

Exact tasks are defined in:

agent/meta/agent-tasks.md

---

# Operational Execution Model

Development proceeds through plans.

Each active plan contains execution items.

Agents operate on one item at a time.

Plans are complete when:

- no open items remain
- no review items remain
- plan goals are satisfied

Technical execution guidance:

- prefer introducing and stabilizing one new technical capability within a single plan
- avoid spreading a single technical capability across multiple plans unless explicitly required

Final acceptance is performed by the human stakeholder.

---

# Framework Evolution

The development framework may evolve over time.

Adjustments may include:

- new automation scripts
- additional agent tasks
- improved templates

Changes should be reflected in the Meta Layer.

---

# Change Notes

- 2026-03-09: Marked `capabilities.md` as optional and recommended it only once project/use-case complexity justifies a dedicated capability layer.
- 2026-03-09: Added optional companion `plan-item-<id>.md` model and `plan-item` task references in execution, templates, and automation sections.
