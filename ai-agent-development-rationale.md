
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

This document is meta‑documentation about the development system itself.

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
- milestones
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
- milestones.md
- capabilities.md
- tech-stack.md
- engineering-guardrails.md
- test-strategy.md

Purpose:
Defines long‑term project direction and constraints.

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

### capabilities.md

Purpose:
Defines what the system must be capable of doing.

Contains:
- functional capabilities
- high-level system abilities

Excludes:
- UI flows
- implementation details

---

### milestones.md

Purpose:
Defines incremental development stages.

Contains:
- milestone identifiers
- milestone goals

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
- api-contract.md (optional)

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

### api-contract.md

Purpose:
Defines interfaces between system components.

Contains:
- API structures
- message formats
- interface responsibilities

Optional when systems expose meaningful APIs.

---

# Execution Framework

Location:
agent/execution/

Example structure:

agent/execution/milestone-0001/
open-item-0001.md
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

---

# Templates

Location:
agent/templates/

Required file:
item-template.md

Purpose:
Defines structure used when creating execution items.

Lightweight template policy:
- keep templates minimal and readable
- define only a small set of core fields
- use optional fields only when they add clear value

Recommended core fields for execution items:
- goal
- scope
- acceptance-criteria
- references

Optional fields when needed:
- assumptions
- out-of-scope
- dependencies

The template is a guiding convention, not a rigid schema.

---

# Automation Framework

Location:
scripts/

Typical scripts:

- get-next-item.sh
- update-milestone-summary.sh
- build-agent-prompt.sh
- run-agent.sh

Scripts handle deterministic operations such as:
- resolving next work item
- generating prompts
- generating summaries

---

# Context Resolution

Agents must not determine their working context by scanning the repository.

Instead scripts provide context.

Example:
scripts/get-next-item.sh open

Returns the next open execution item.

Prompt build heuristic (default order):
1. execution item
2. engineering guardrails and test strategy
3. directly referenced strategy and design files
4. additional files only if a concrete ambiguity blocks implementation

This order is a default, not a hard constraint. If adding context is likely to prevent substantial rework, context may be expanded deliberately.

Minimal context recovery:
- missing file: stop deterministic flow, report the missing path, request/prepare correction
- inconsistent state (e.g. conflicting item status): do not guess; flag and require normalization
- unclear reference: proceed with the best bounded assumption and record it in the item output

---

# Agent Interaction Model

Agents are invoked using deterministic commands.

Examples:
DevGo
ReviewGo
RefineGo

Commands trigger scripts that:
1. determine context
2. gather required documents
3. generate the prompt

---

# Agent Types and Tasks

Agent types:
- framework agent
- refinement agent
- implementation agent
- review agent

Tasks may include:
- implement next open item
- review next review item
- review architectural consistency
- review tech stack adherence

Exact tasks are defined in:
agent/meta/agent-tasks.md

---

# Operational Execution Model

Development proceeds through milestones.

Each milestone contains execution items.

Agents operate on one item at a time.

Milestones are complete when:
- no open items remain
- no review items remain
- milestone goals are satisfied

Final acceptance is performed by the human stakeholder.

---

# Framework Evolution

The development framework may evolve over time.

Adjustments may include:
- new automation scripts
- additional agent tasks
- improved templates

Changes should be reflected in the Meta Layer.

Governance-lite for framework changes:
- add a short change note describing what changed
- include a concise rationale (why this improves reliability, speed, or clarity)
- describe expected impact on agent workflows
- keep process overhead low; do not require heavy formal artifacts by default

Escalate to stricter review only for high-impact or breaking changes.

---

# Initial Documentation Structure Script

The following script creates the documentation framework.

It is idempotent.

```bash
mkdir -p agent/meta
mkdir -p agent/strategy
mkdir -p agent/design
mkdir -p agent/execution
mkdir -p agent/templates
mkdir -p scripts

touch agent/meta/rationale.md
touch agent/meta/agent-setup.md
touch agent/meta/agent-tasks.md

touch agent/strategy/milestones.md
touch agent/strategy/capabilities.md
touch agent/strategy/tech-stack.md
touch agent/strategy/engineering-guardrails.md
touch agent/strategy/test-strategy.md

touch agent/design/use-cases.md
touch agent/design/domain-model.md
touch agent/design/api-contract.md

touch agent/templates/item-template.md

touch scripts/get-next-item.sh
touch scripts/update-milestone-summary.sh
touch scripts/build-agent-prompt.sh
touch scripts/run-agent.sh
```
