# Agent Setup

## Purpose

This document defines how AI agents are invoked, configured, and executed within this project.

It connects:

- the task definitions in `agent/meta/agent-tasks.md`
- the documentation structure
- the automation scripts

While `agent-tasks.md` defines what tasks exist, this document defines how agents perform them.

This file is intended for:

- AI agents executing tasks
- the human stakeholder orchestrating task execution
- scripts that construct agent prompts

---

# Core Principles

## Deterministic Operation

Agents must operate deterministically whenever possible.

This means:

- the next work item must be determined by scripts
- repository exploration must not be used to discover work
- task inputs must be explicit
- task scripts should scope execution to the active plan state in `agent/execution`

Agents must not infer repository state through guessing.

When deterministic resolution fails, the agent must report the problem rather than inventing behaviour.

## Task-Only Execution

This project uses a task-only operating model.

Execution assumptions:

- each execution starts with fresh context
- behavior is derived from the invoked task
- no persistent identity is assumed between executions
- scripts and task definitions are the authoritative execution contract
- archived plan artifacts are excluded from normal operational task scope

## Minimal Necessary Context

Agents should load only the context necessary to complete the task correctly.

Context loading order:

1. execution item
2. engineering guardrails
3. test strategy
4. referenced strategy or design documents
5. tech stack if architectural decisions are involved
6. security baseline and project security strategy when security-sensitive decisions are involved

Additional documents should only be loaded if a specific ambiguity blocks implementation.

## Strategy Documents Describe Current Reality

Strategy and design documents represent the current system state, not future plans.

Future ideas should not appear in the agent documentation layer until they are part of an active plan.

Agents must assume that these documents describe the authoritative current architecture.

---

# Task Invocation Model

Agents are invoked by the human stakeholder.

Invocation specifies:

- task
- optional scope clarification

Example conceptual invocation:

```
Task: implement-item
```

or

```
Task: review-architecture
```

Short-prefix alternative:

```
T: do
```

Case-insensitive equivalents are valid as well (for example `task: implement-item` and `t: do`).

Agents must follow behavior defined for the selected task.

---

# Script Usage

Certain operations must always be delegated to scripts.

Agents must not reimplement these behaviours internally.

## tasks.sh

Purpose:

Resolve a task name to its task-specific instruction script.

Supported invocation styles for core tasks:

- canonical task name (for example `implement-item`)
- verb alias (for example `implement`)
- short verb alias (for example `do`)
- numeric alias (for example `4`)

Current core alias mapping:

- discuss-plan: `discuss`, `go`, `1`
- refine-plan: `refine`, `split`, `2`
- plan-item: `plan`, `3`
- implement-item: `implement`, `do`, `4`
- review-item: `review`, `see`, `5`
- finalize-plan: `finalize`, `end`, `6`

Example:

```
agent/scripts/tasks.sh implement-item
agent/scripts/tasks.sh do
agent/scripts/tasks.sh 4
agent/scripts/tasks.sh review-item
```

Expected result:

- deterministic task instruction output for the selected task

## task-implement-item.sh

Purpose:

Resolve the next open execution item and emit deterministic instruction/context pointers for implementation.

If a matching optional plan file exists (`plan-item-<id>.md`), it is loaded automatically.

## task-discuss-plan.sh

Purpose:

Load active planning context and emit deterministic discussion guidance for stakeholder-first plan shaping.

Notes:

- the script emits `PLAN_ID_SUGGESTED=<id>` to help normalize plan IDs when the current plan file still contains a placeholder or unclear value
- discussion must start from stakeholder input; agent proposals are optional and only on explicit request
- discussion should stay short and iterative (1-3 focused questions per turn) and avoid early full-plan output
- full plan summaries should be emitted only when requested by the stakeholder or after explicit permission to summarize
- discuss output must not suggest or ask to execute the next task
- after discussion document changes are complete, run `agent/scripts/finalize-discuss-plan.sh` to commit and push plan/discussion updates

## finalize-discuss-plan.sh

Purpose:

Commit and push deterministic completion updates for `discuss-plan` after plan/discussion documents were updated.

## task-plan-item.sh

Purpose:

Resolve the next open execution item and emit deterministic instruction/context pointers for creating or updating an optional implementation plan file (`plan-item-<id>.md`).

## finalize-plan-item.sh

Purpose:

Commit and push deterministic completion updates for `plan-item` after the selected optional plan file was created or modified.

## task-review-item.sh

Purpose:

Resolve the next review execution item and emit deterministic instruction/context pointers for review.

## task-refine-plan.sh

Purpose:

Emit deterministic context pointers for refining active plan scope into execution items.

## finalize-refine-plan.sh

Purpose:

Commit and push deterministic completion updates for `refine-plan` after execution item files were created or updated.

## task-review-consistency.sh

Purpose:

Emit deterministic context pointers for consistency review of the current plan state.

## task-review-architecture.sh

Purpose:

Emit deterministic context pointers for architecture review of the current plan state.

## task-finalize-plan.sh

Purpose:

Validate plan-finalization preconditions and emit deterministic instructions for plan archive finalization.

## task-review-technology.sh

Purpose:

Emit deterministic context pointers for technology-stack adherence review.

## task-review-quality.sh

Purpose:

Emit deterministic context pointers for quality-attribute and test-confidence review.

## task-review-security.sh

Purpose:

Emit deterministic context pointers for security posture review.

## finalize-review-accept-item.sh

Purpose:

Apply deterministic review acceptance transition (`review-item-*` -> `done-item-*`).

## finalize-review-return-item.sh

Purpose:

Apply deterministic review return transition (`review-item-*` -> `open-item-*`) and append structured findings to the item.

## finalize-implement-item.sh

Purpose:

Perform deterministic completion actions for `implement-item`, including state transition and repository actions.

## finalize-plan.sh

Purpose:

Archive the active plan and all work item files under `archive/<plan-id>_<plan-name-with-hyphens>/`, then bootstrap a fresh `agent/strategy/plan.md` from the plan template.

---

# Context Loading Rules

Agents should load context progressively.

Default order:

1. execution item
2. engineering guardrails
3. test strategy
4. optional plan file for the selected item, if present
5. referenced strategy documents
6. referenced design documents
7. tech stack
8. security baseline and project security strategy when relevant

Agents should stop loading additional context once the task can be completed with confidence.

---

# Error Handling

Agents must follow strict behaviour when encountering inconsistencies.

Required `LOAD` paths are validated by task scripts. Missing required files must stop deterministic execution.

## Missing File

If a referenced file cannot be found:

1. report the missing file path
2. stop deterministic execution
3. request correction

## Conflicting State

Example:

- item marked both open and review
- duplicate item numbers

Required behaviour:

- do not guess resolution
- report inconsistency
- request normalization

## Ambiguous Requirement

If an item is unclear:

- interpret using the most conservative bounded assumption
- document the assumption in the output

---

# Execution Expectations

Each task execution should produce:

- a clear result
- structured findings when issues are discovered
- deterministic state changes when applicable

Examples:

`implement-item`:

- modify code
- move item state open -> review

`plan-item`:

- create or update `plan-item-<id>.md` next to the selected open item
- keep plan lightweight and bounded to item scope
- finalize by running `agent/scripts/finalize-plan-item.sh <plan-item-path>` to commit and push changes

`review-item`:

- approve item review -> done
- return item review -> open with clear findings

plan-state review tasks (`review-consistency`, `review-architecture`, `review-technology`, `review-quality`, `review-security`):

- produce structured findings for the reviewed aspect
- do not silently modify implementation during review

`finalize-plan`:

- archive active `plan.md` and all `*item-*.md` files into `archive/<plan-id>_<plan-name-with-hyphens>/`
- create a fresh `agent/strategy/plan.md` from `agent/templates/plan-template.md`
- commit and push archive/fresh-plan state changes

---

# Task Boundary Rules

Task executions must remain within task scope.

`implement-item` must not:

- rewrite strategy documents
- change architecture direction without explicit approval
- treat a plan file as a replacement for the item definition

`plan-item` must not:

- implement code
- redefine item scope or acceptance criteria

`review-item` must not:

- silently rewrite implementation
- introduce unrelated changes

`refine-plan` must not:

- implement code
- redefine plan goals

`review-consistency` must not:

- include deep architecture, technology, quality, or security judgments

`review-architecture` must not:

- expand into broad quality or security assessment unless directly architectural

`review-technology` must not:

- debate architecture direction beyond stack adherence

`review-quality` must not:

- turn into a security-only assessment

`review-security` must not:

- require compliance-grade controls unless explicitly requested

Framework changes should always be discussed with the human stakeholder.

---

# Automation Expectations

Agents should prefer deterministic automation to reasoning when possible.

Preferred:

- calling scripts
- reading explicit references

Avoid:

- scanning directories for work
- inferring plan progress
- guessing architecture intent

---

# Evolution of Agent Setup

This file may evolve as the framework matures.

Possible improvements:

- new automation scripts
- improved prompt construction
- refined context loading rules

Changes should be small, documented, and motivated by real workflow improvements.

---

# Change Notes

- 2026-03-09: Added `task-finalize-plan.sh` and `finalize-plan.sh`; aligned setup wording from plan-state to plan-state execution.
- 2026-03-09: Added optional `plan-item` task flow and automatic optional plan loading in `implement-item`.
- 2026-03-08: Added plan-state review task scripts and setup guidance for consistency, architecture, technology, quality, and security reviews.
- 2026-03-08: Switched fully to task-only execution wording.
- 2026-03-08: Initial agent setup definition created.
