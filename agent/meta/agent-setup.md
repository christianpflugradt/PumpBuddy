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

Agents must not infer repository state through guessing.

When deterministic resolution fails, the agent must report the problem rather than inventing behaviour.

## Task-Only Execution

This project uses a task-only operating model.

Execution assumptions:

- each execution starts with fresh context
- behavior is derived from the invoked task
- no persistent identity is assumed between executions
- scripts and task definitions are the authoritative execution contract

## Minimal Necessary Context

Agents should load only the context necessary to complete the task correctly.

Context loading order:

1. execution item
2. engineering guardrails
3. test strategy
4. referenced strategy or design documents
5. tech stack if architectural decisions are involved

Additional documents should only be loaded if a specific ambiguity blocks implementation.

## Strategy Documents Describe Current Reality

Strategy and design documents represent the current system state, not future plans.

Future ideas should not appear in the agent documentation layer until they are part of a milestone.

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

Agents must follow behavior defined for the selected task.

---

# Script Usage

Certain operations must always be delegated to scripts.

Agents must not reimplement these behaviours internally.

## tasks.sh

Purpose:

Resolve a task name to its task-specific instruction script.

Example:

```
scripts/tasks.sh implement-item
scripts/tasks.sh review-item
```

Expected result:

- deterministic task instruction output for the selected task

## task-implement-item.sh

Purpose:

Resolve the next open execution item and emit deterministic instruction/context pointers for implementation.

## task-review-item.sh

Purpose:

Resolve the next review execution item and emit deterministic instruction/context pointers for review.

## task-refine-milestone.sh

Purpose:

Emit deterministic context pointers for refining milestone scope into execution items.

## finalize-implement-item.sh

Purpose:

Perform deterministic completion actions for `implement-item`, including state transition and repository actions.

---

# Context Loading Rules

Agents should load context progressively.

Default order:

1. execution item
2. engineering guardrails
3. test strategy
4. referenced strategy documents
5. referenced design documents
6. tech stack

Agents should stop loading additional context once the task can be completed with confidence.

---

# Error Handling

Agents must follow strict behaviour when encountering inconsistencies.

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

`review-item`:

- approve item review -> done
- return item review -> open with clear findings

---

# Task Boundary Rules

Task executions must remain within task scope.

`implement-item` must not:

- rewrite strategy documents
- change architecture direction without explicit approval

`review-item` must not:

- silently rewrite implementation
- introduce unrelated changes

`refine-milestone` must not:

- implement code
- redefine milestone goals

Framework changes should always be discussed with the human stakeholder.

---

# Automation Expectations

Agents should prefer deterministic automation to reasoning when possible.

Preferred:

- calling scripts
- reading explicit references

Avoid:

- scanning directories for work
- inferring milestone progress
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

- 2026-03-08: Switched fully to task-only execution wording.
- 2026-03-08: Initial agent setup definition created.
