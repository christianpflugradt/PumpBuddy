# Agent Tasks

## Purpose

This document defines the project-specific tasks used in this repository.

It is written for AI agents and for the human stakeholder operating them.

Its purpose is to:

- define the standard executable tasks
- define which tasks are core and which are extended
- define task boundaries so executions stay deterministic and consistent across runs

This document does not define product functionality.
It defines how AI agents are expected to work within the development framework through task-driven execution.

## Scope and Usage

This file should be used when:

- invoking an agent task
- implementing script-backed task commands
- reviewing whether an execution stayed within the intended task scope
- extending the task operating model of the project

This file is part of the meta layer and should not be loaded by operational agents unless invocation or prompt-building explicitly requires it.

## Task-Driven Operating Model

This project uses a task-only model.

Execution assumptions:

- each execution starts with a fresh context
- behavior is derived from the selected task
- no persistent execution identity is assumed across runs
- task scripts and task definitions are the authoritative source of behavior

Tasks are executable work patterns.

The project distinguishes between:

- core tasks: expected to be used regularly
- extended tasks: available when deeper checks are needed

Each task definition includes:

- purpose
- typical trigger
- minimum expected inputs
- expected outputs
- completion condition
- boundaries (what the task must not do)

## Core Tasks

### refine-milestone

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

Boundaries:

- do not implement code directly
- do not silently change architecture direction
- do not redefine milestone goals

### implement-item

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

Boundaries:

- do not expand scope beyond the item without explicit justification
- do not introduce major technology changes without explicit approval
- do not modify framework documents unless explicitly requested

### review-item

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

Boundaries:

- do not silently rewrite system direction
- do not accept architecture drift
- do not treat unclear situations as automatically acceptable

## Extended Tasks

### review-consistency

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

Boundaries:

- do not implement unrelated fixes during the review task
- do not broaden scope beyond the reviewed context

### review-tech-stack

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

- confirmation of adherence, or
- findings describing stack drift, violations, or questionable deviations

Completion condition:

The reviewed scope has been checked against the tech stack and the result has been recorded.

Boundaries:

- do not rewrite implementation as part of this task
- do not redefine stack decisions without explicit stakeholder approval

### review-architecture

Purpose:

Check whether the current implementation still aligns with intended architectural structure and constraints.

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

Boundaries:

- do not change architecture direction implicitly
- do not convert review findings into silent implementation changes

## Task Set Summary

Core tasks:

- refine-milestone
- implement-item
- review-item

Extended tasks:

- review-consistency
- review-tech-stack
- review-architecture

Framework-level changes are conversation-driven and explicitly requested by the human stakeholder.

## Task Design Rules

New tasks added later should follow these rules:

- each task must have a clearly bounded purpose
- each task must define minimum required inputs
- each task must define an observable completion condition
- each task must define explicit boundaries
- tasks should be named with lowercase words and hyphens
- tasks should remain deterministic and operationally narrow
- tasks should not overlap heavily unless there is a clear reason

## Command Naming Guidance

If command aliases are introduced in scripts, they should map clearly to the task names in this file.

Preferred pattern:

- one command alias per task
- command naming close to task naming
- no hidden task switching behind ambiguous commands

Examples:

- refine-milestone
- implement-item
- review-item
- review-consistency
- review-tech-stack
- review-architecture

Human-friendly aliases may exist, but the task names in this document remain the authoritative names.

## Change Notes

- 2026-03-08: Switched to a task-only operating model and defined task boundaries as the sole behavior contract.
- 2026-03-08: Initial project-specific task model defined with a small core-plus-extended task set.
