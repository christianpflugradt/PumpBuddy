# Agent Tasks

## Purpose

This document defines the **agent roles** and **project-specific tasks** used in this repository.

It is written for AI agents and for the human stakeholder operating them.

Its purpose is to:

- define the stable role model used in this project
- define the standard executable tasks for those roles
- define which tasks are core and which are extended
- keep agent behaviour deterministic and consistent across runs

This document does not define product functionality.
It defines how AI agents are expected to work within the development framework.

## Scope and Usage

This file should be used when:

- configuring or invoking an agent task
- implementing script-backed agent commands
- reviewing whether an agent acted within its intended scope
- extending the agent operating model of the project

This file is part of the **meta layer** and should not be loaded by operational agents unless their invocation or prompt-building flow explicitly requires it.

## Role Model

The project uses four roles.

### Refinement

Purpose:

Transform milestone intent into concrete execution items.

Responsibilities:

- interpret the current milestone
- identify the work required to move the project forward
- split work into small, reviewable execution items
- keep item scopes narrow and implementation-ready

This role must not:

- implement code directly
- silently change architecture
- redefine milestone goals

### Implementation

Purpose:

Carry out one execution item at a time.

Responsibilities:

- implement the selected item
- update tests when required by the item or guardrails
- keep changes aligned with the current strategy and design documents
- move the item from open to review when complete

This role must not:

- expand scope beyond the item without explicit justification
- introduce major technology changes
- alter framework documents

### Review

Purpose:

Check whether implemented work is correct, consistent, and aligned with project constraints.

Responsibilities:

- review items in review state
- detect missing requirements or inconsistencies
- verify alignment with architecture, tech stack, and guardrails
- create or return follow-up work when problems are found

This role must not:

- silently rewrite system direction
- accept architecture drift
- treat unclear situations as automatically acceptable

### Framework

Purpose:

Support changes to the AI-agent development framework itself.

Responsibilities:

- discuss framework changes with the human stakeholder
- help improve the documentation structure and agent operating model
- refine templates, task definitions, and framework conventions

This role has no predefined executable task in this file.

Framework changes are expected to happen through explicit human-led conversation rather than through a standard command.

## Task Model

Tasks are executable work patterns assigned to roles.

The project distinguishes between:

- **core tasks**: expected to be used regularly
- **extended tasks**: available when deeper checks are needed

Each task definition includes:

- owning role
- purpose
- typical trigger
- minimum expected inputs
- expected outputs
- completion condition

## Core Tasks

### refine-milestone

Role:
Refinement

Purpose:

Break the currently active milestone into execution items.

Typical trigger:

Use when a new milestone becomes active and no implementation-ready item set exists yet.

Minimum expected inputs:

- current milestone definition
- capabilities
- relevant use cases, if they exist
- relevant design documents, if they exist
- tech stack
- engineering guardrails
- test strategy

Expected outputs:

- new execution item files for the active milestone
- item scopes small enough to be implemented and reviewed in one step
- references from items to the strategy or design documents they depend on

Completion condition:

The active milestone has a usable initial set of execution items in the execution directory.

### implement-item

Role:
Implementation

Purpose:

Implement the next open execution item.

Typical trigger:

Use when there is at least one open item in the active milestone.

Minimum expected inputs:

- the selected open item
- engineering guardrails
- test strategy
- referenced strategy and design documents
- tech stack, when architecture or technology choices are relevant

Expected outputs:

- code changes
- test changes where required
- documentation updates if the item explicitly requires them
- item moved from open to review when implementation is complete

Completion condition:

The selected item has been implemented to the best bounded interpretation of its scope and is ready for review.

### review-item

Role:
Review

Purpose:

Review the next item that is in review state.

Typical trigger:

Use when at least one item is waiting for review.

Minimum expected inputs:

- the selected review item
- referenced strategy and design documents
- engineering guardrails
- test strategy
- tech stack when relevant

Expected outputs:

- a decision that the item is acceptable, or
- clear findings describing why the item is not acceptable
- follow-up work represented through the existing item workflow

Completion condition:

The reviewed item is either accepted as done or returned for further work with clear findings.

## Extended Tasks

### review-consistency

Role:
Review

Purpose:

Check consistency across the current implementation, active milestone, and relevant project documents.

Typical trigger:

Use when there is concern that implementation, design, and strategy may have drifted apart.

Minimum expected inputs:

- current milestone
- relevant execution items
- capabilities
- use cases, if they exist
- domain model, if it exists
- API contract, if it exists
- engineering guardrails
- tech stack

Expected outputs:

- identified consistency problems or explicit confirmation that no significant consistency issues were found
- follow-up work suggestions if gaps are discovered

Completion condition:

Consistency risks for the current scope have been reviewed and documented.

### review-tech-stack

Role:
Review

Purpose:

Check whether the implementation still adheres to the defined tech stack.

Typical trigger:

Use after significant technical changes, dependency changes, or when drift is suspected.

Minimum expected inputs:

- tech stack
- relevant source code and configuration files
- dependency manifests
- build and CI configuration when relevant

Expected outputs:

- confirmation of adherence or
- findings describing stack drift, violations, or questionable deviations

Completion condition:

The reviewed scope has been checked against the tech stack and the result has been recorded.

### review-architecture

Role:
Review

Purpose:

Check whether the current implementation still aligns with the intended architectural structure and constraints.

Typical trigger:

Use after changes that affect boundaries, layering, integration patterns, testability, or operational shape.

Minimum expected inputs:

- tech stack
- engineering guardrails
- test strategy
- relevant strategy and design documents
- active milestone context where relevant

Expected outputs:

- findings about architectural drift, weak boundaries, or structural risks
- follow-up work suggestions where needed

Completion condition:

Architectural alignment for the reviewed scope has been evaluated and the result has been recorded.

## Role to Task Mapping

### Refinement

Core tasks:
- refine-milestone

Extended tasks:
- none currently defined

### Implementation

Core tasks:
- implement-item

Extended tasks:
- none currently defined

### Review

Core tasks:
- review-item

Extended tasks:
- review-consistency
- review-tech-stack
- review-architecture

### Framework

Core tasks:
- none

Extended tasks:
- none

Framework work is conversation-driven rather than command-driven.

## Task Design Rules

New tasks added later should follow these rules:

- each task must belong to exactly one role
- each task must have a clearly bounded purpose
- each task must define minimum required inputs
- each task must define an observable completion condition
- tasks should be named with lowercase words and hyphens
- tasks should remain deterministic and operationally narrow
- tasks should not overlap heavily unless there is a clear reason

## Initial Command Naming Guidance

If command aliases are introduced in scripts, they should map clearly to the task names in this file.

Preferred pattern:

- one command alias per task
- command naming close to task naming
- no hidden role switching behind ambiguous commands

Examples:

- refine-milestone
- implement-item
- review-item
- review-consistency
- review-tech-stack
- review-architecture

Human-friendly aliases may exist, but the task names in this document remain the authoritative names.

## Change Notes

- 2026-03-08: Initial project-specific role and task model defined with four roles and a small core-plus-extended task set.
