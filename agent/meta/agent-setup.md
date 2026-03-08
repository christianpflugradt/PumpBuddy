# Agent Setup

## Purpose

This document defines how AI agents are **invoked, configured, and executed** within this project.

It connects:

- the **role model** defined in `agent/meta/agent-tasks.md`
- the **task definitions**
- the **documentation structure**
- the **automation scripts**

While `agent-tasks.md` defines *what tasks exist*, this document defines *how agents perform them*.

This file is intended for:

- AI agents executing tasks
- the human stakeholder orchestrating agents
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


## Minimal Necessary Context

Agents should load **only the context necessary to complete the task correctly**.

Context loading order:

1. execution item
2. engineering guardrails
3. test strategy
4. referenced strategy or design documents
5. tech stack if architectural decisions are involved

Additional documents should only be loaded if a **specific ambiguity blocks implementation**.


## Strategy Documents Describe Current Reality

Strategy and design documents represent the **current system state**, not future plans.

Future ideas should not appear in the agent documentation layer until they are part of a milestone.

Agents must assume that these documents describe the **authoritative current architecture**.


---

# Agent Invocation Model

Agents are invoked by the human stakeholder.

Invocation specifies:

- role
- task
- optional scope clarification

Example conceptual invocation:

```
Role: Implementation
Task: implement-item
```

or

```
Role: Review
Task: review-architecture
```

Agents must follow the behaviour defined for the corresponding role and task.


---

# Script Usage

Certain operations must always be delegated to scripts.

Agents must not reimplement these behaviours internally.

## get-next-item.sh

Purpose:

Resolve the next execution item for a given state.

Example:

```
scripts/get-next-item.sh open
scripts/get-next-item.sh review
```

Expected result:

- path to the next execution item file

If no item exists, the script must return an empty result.

Agents must not scan directories to determine this themselves.


## build-agent-prompt.sh

Purpose:

Construct the prompt used to run an agent task.

The script may gather:

- item content
- required guardrails
- referenced documents

Agents should rely on this mechanism whenever available.


## update-milestone-summary.sh

Purpose:

Generate human-readable milestone summaries.

Agents should treat the generated summary as informational only and should not use it as authoritative input.


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

Each agent task execution should produce:

- a clear result
- structured findings when issues are discovered
- deterministic state changes when applicable

Examples:

Implementation tasks:

- modify code
- move item state open → review

Review tasks:

- approve item review → done
- return item review → open with findings


---

# Role Interaction Rules

Roles must remain within their scope.

Implementation must not:

- rewrite strategy documents
- change architecture direction


Review must not:

- silently rewrite implementation
- introduce unrelated changes


Refinement must not:

- implement code
- redefine milestone goals


Framework role changes should always be discussed with the human stakeholder.


---

# Automation Expectations

Agents should prefer deterministic automation to reasoning when possible.

Examples:

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

- 2026-03-08: Initial agent setup definition created.
