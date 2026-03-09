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
- operational scope is the active plan in `agent/execution`; archived plans are out of scope for normal task execution

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

### refine-plan

Purpose:

Break the currently active plan into execution items.

Typical trigger:

Use when a new plan becomes active and no implementation-ready item set exists yet.

Minimum expected inputs:

- current plan definition
- capabilities, if present
- relevant use cases, if they exist
- relevant design documents, if they exist
- tech stack
- engineering guardrails
- test strategy

Expected outputs:

- new execution item files for the active plan
- item scopes small enough to be implemented and reviewed in one step
- references from items to the strategy or design documents they depend on
- each item has one primary deliverable outcome
- each item acceptance criteria includes at least one executable verification step (command or runtime check)
- refinement changes are finalized through `scripts/finalize-refine-plan.sh` to commit and push state updates

Completion condition:

The active plan has a usable initial set of execution items in the execution directory.

Boundaries:

- do not implement code directly
- do not silently change architecture direction
- do not redefine plan goals
- do not modify `agent/strategy/plan.md` during refinement
- do not create multi-outcome items that combine unrelated deliverables

### plan-item

Purpose:

Create an optional lightweight implementation plan for the next open execution item.

Typical trigger:

Use before `implement-item` when an item has higher uncertainty, larger change scope, or higher risk.

Minimum expected inputs:

- the selected open item
- engineering guardrails
- test strategy
- tech stack when technology decisions are involved
- plan item template

Expected outputs:

- a plan file next to the item using `plan-item-<id>.md`
- concise implementation approach, risk notes, and validation plan
- plan updates are finalized through `scripts/finalize-plan-item.sh <plan-item-path>` to commit and push state updates

Completion condition:

A usable plan exists for the selected item and can be loaded by `implement-item`.

Boundaries:

- do not implement code
- do not redefine item scope or acceptance criteria
- do not change strategy direction implicitly

### implement-item

Purpose:

Implement the next open execution item.

Typical trigger:

Use when there is at least one open item in the active plan.

Minimum expected inputs:

- the selected open item
- optional plan file for the selected item, if present
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
- do not treat an optional plan as a scope override; the item remains authoritative

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
- acceptance decisions include evidence of at least one executed runtime/build verification check

Completion condition:

The reviewed item is either accepted as done or returned for further work with clear findings.

Boundaries:

- do not silently rewrite system direction
- do not accept architecture drift
- do not treat unclear situations as automatically acceptable
- do not accept items without concrete, executed runtime/build evidence when the item has runnable or buildable outcomes

### finalize-plan

Purpose:

Finalize the active plan and archive plan plus work items when execution is complete.

Typical trigger:

Use when implementation/review work for the active plan is complete.

Minimum expected inputs:

- active plan file (`agent/strategy/plan.md`)
- at least one done item
- no open or review items
- plan template for bootstrapping the next plan

Expected outputs:

- archive folder `Archive/<plan-id>_<plan-name-with-hyphens>/` containing:
  - archived `plan.md`
  - all work item files (`*item-*.md`), including optional plan-item files
- fresh `agent/strategy/plan.md` copied from `agent/templates/plan-template.md`

Completion condition:

The active plan and all work item files are archived under `<plan-id>_<plan-name-with-hyphens>`, and a new blank plan file exists for the next cycle.

Boundaries:

- do not finalize while open or review items exist
- do not finalize when no done item exists
- do not overwrite an existing archive folder for the same plan ID

## Extended Tasks

The extended review set is designed to be as MECE as practical:

- `review-consistency`: cross-artifact alignment only
- `review-architecture`: structure and boundaries only
- `review-technology`: stack and dependency adherence only
- `review-quality`: quality attributes and verification effectiveness
- `review-security`: trust boundaries and security posture

### review-consistency

Purpose:

Check consistency across implementation, plan state, and project documents.

Focus:

- alignment between plan intent, execution items, and implementation state
- alignment between item references and actual changes
- alignment between strategy/design documents and observed behavior

Must not evaluate:

- deep architecture quality (handled by `review-architecture`)
- technology policy violations (handled by `review-technology`)
- non-functional quality attributes (handled by `review-quality`)
- security controls and threat posture (handled by `review-security`)

Typical trigger:

Use when there is concern that implementation, design, and strategy may have drifted apart.

Minimum expected inputs:

- current plan
- relevant execution items
- capabilities, if present
- use cases, if they exist
- domain model, if it exists
- API contracts, if they exist
- engineering guardrails

Expected outputs:

- identified consistency problems or explicit confirmation that no significant consistency issues were found
- follow-up work suggestions if gaps are discovered

Completion condition:

Consistency risks for the current scope have been reviewed and documented.

Boundaries:

- do not implement unrelated fixes during the review task
- do not broaden scope beyond the reviewed context

### review-architecture

Purpose:

Check whether the current implementation still aligns with intended architectural structure and constraints.

Focus:

- boundaries and separation of concerns
- layering and dependency direction
- coupling and cohesion at component/module level
- fit between architecture intent and actual implementation shape

Must not evaluate:

- stack policy/dependency drift except where it directly breaks architecture boundaries
- broad test quality or performance characteristics unless architecturally critical
- detailed security hardening controls

Typical trigger:

Use after changes that affect boundaries, layering, integration patterns, testability, or operational shape.

Minimum expected inputs:

- tech stack
- engineering guardrails
- relevant strategy and design documents
- active plan context where relevant

Expected outputs:

- findings about architectural drift, weak boundaries, or structural risks
- follow-up work suggestions where needed

Completion condition:

Architectural alignment for the reviewed scope has been evaluated and the result has been recorded.

Boundaries:

- do not change architecture direction implicitly
- do not convert review findings into silent implementation changes

### review-technology

Purpose:

Check whether implementation and tooling adhere to defined technology decisions.

Focus:

- tech stack adherence
- dependency and framework choices
- version and compatibility policy alignment
- build/CI/tooling consistency with stack decisions

Must not evaluate:

- architecture quality beyond stack adherence
- broad product quality attributes
- security control depth except obvious stack-level violations

Typical trigger:

Use after significant technical changes, dependency changes, or when stack drift is suspected.

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

### review-quality

Purpose:

Check whether the current implementation quality is sufficient for the current plan state.

Focus:

- test strategy adherence and effectiveness
- reliability and error-handling robustness
- performance and resource behavior at practical baseline level
- maintainability and observability basics where applicable

Must not evaluate:

- stack governance questions (handled by `review-technology`)
- architectural boundary correctness (handled by `review-architecture`)
- security posture depth (handled by `review-security`)

Typical trigger:

Use before plan acceptance or after changes that materially affect correctness, stability, or test confidence.

Minimum expected inputs:

- test strategy
- engineering guardrails
- relevant execution items
- relevant source code and tests

Expected outputs:

- quality findings grouped by risk and impact
- explicit confidence statement on plan-readiness for the reviewed scope

Completion condition:

Quality risks for the reviewed scope are documented with clear severity and follow-up suggestions.

Boundaries:

- do not redefine acceptance criteria outside the reviewed scope
- do not include security-only findings except when they directly impact reliability/quality evidence

### review-security

Purpose:

Check whether implementation and topology align with the intended security model.

Focus:

- trust boundaries and exposure model
- authentication and authorization model adherence
- secret handling and credential/token management basics
- high-risk security gaps relevant to the current scope

Must not evaluate:

- generic code quality concerns not security-relevant
- broad architecture quality unless it creates direct security exposure
- stack preference debates unless they create direct security risk

Typical trigger:

Use before plan acceptance, after auth/access changes, after interface exposure changes, or when security drift is suspected.

Minimum expected inputs:

- security baseline
- project security strategy
- tech stack
- relevant source/configuration/deployment files
- active plan context where relevant

Expected outputs:

- identified security risks and boundary violations, or explicit confirmation that no significant issues were found
- prioritized remediation suggestions for discovered risks

Completion condition:

Security posture for the reviewed scope has been assessed and significant risks have been documented.

Boundaries:

- do not require enterprise-level controls unless explicitly part of project constraints
- do not expand into full compliance auditing unless explicitly requested

## Task Set Summary

Core tasks:

- refine-plan
- plan-item
- implement-item
- review-item
- finalize-plan

Extended tasks:

- review-consistency
- review-architecture
- review-technology
- review-quality
- review-security

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

- refine-plan
- plan-item
- implement-item
- review-item
- finalize-plan
- review-consistency
- review-architecture
- review-technology
- review-quality
- review-security

Human-friendly aliases may exist, but the task names in this document remain the authoritative names.

## Change Notes

- 2026-03-09: Added `finalize-plan` task with deterministic archive workflow and switched refinement/consistency wording to active plan.
- 2026-03-09: Marked capabilities as optional task input for early-stage projects; use cases may be sufficient initially.
- 2026-03-09: Added optional `plan-item` task with companion-file model (`plan-item-<id>.md`) and `implement-item` integration.
- 2026-03-08: Added MECE-oriented extended review set (`review-consistency`, `review-architecture`, `review-technology`, `review-quality`, `review-security`) with explicit scope boundaries.
- 2026-03-08: Switched to a task-only operating model and defined task boundaries as the sole behavior contract.
- 2026-03-08: Initial project-specific task model defined with a small core-plus-extended task set.
