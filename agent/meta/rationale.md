# AI Agent Development Rationale

## Purpose

This document explains the framework philosophy behind AI-assisted development in this repository.
It is a meta-level document for framework design and evolution, not an operational runtime instruction file.

Operational source of truth remains:

- task scripts (`agent/scripts/**`)
- task context contracts (`agent/execution/task-context/*.yaml`)
- task behavior specs (`agent/execution/task-spec/*.yaml`)

## Core Goals

The framework is designed to maximize:

- deterministic execution
- token efficiency over full delivery cycles
- structural consistency across project contracts
- maintainability for both agents and human stakeholders

## Principle 1: Determinism via Scripts

Deterministic work should be solved by scripts, not delegated to agent judgment.

This means:

- task resolution is script-driven
- sequencing is explicit
- state transitions are explicit
- checks and invariants are script-enforced

Agents should focus on non-deterministic work (reasoning, implementation choices, review judgment), while deterministic mechanics are automated.

## Principle 2: Token Efficiency as End-to-End Metric

Token efficiency is not “minimum context per prompt.”
It is measured across the full path to an accepted result.

Practical interpretation:

- context should be as small as possible **and** as large as necessary
- adding context is good when it meaningfully reduces rework
- reducing context is good when it does not increase iteration count

Success metric:

- minimal total token cost from first attempt to accepted completion (including revisions)

## Principle 3: Structured Contracts over Freeform Docs

The framework favors structured YAML contracts for operational artifacts.

Why:

- predictable structure for agents
- lower ambiguity during generation and review
- deterministic validation
- reduced drift risk

Markdown is still used where narrative clarity is more important than strict structure (for example meta rationale and human-oriented explanations).

## Principle 4: Continuous Validation to Prevent Drift

Framework contracts are validated continuously so structure and relationships remain consistent.

Validation goals:

- reject schema drift (missing required fields, unknown fields, type mismatches)
- reject cross-file drift (IDs, modes, references, lifecycle semantics)
- reject execution-state inconsistencies
- surface script hygiene issues early

This prevents silent degradation of the agent framework as it evolves.

## Principle 5: Project-Agnostic Extensibility

The framework must remain reusable across different projects.

Therefore:

- framework does **not** require a fixed list of strategy/design filenames
- project teams can define their own contract set
- each task declares its needed context explicitly via task-context configuration
- validation model registry is extensible and project-specific

This keeps the framework flexible without giving up determinism.

## Documentation Layer Model

The framework organizes documents into layers with different responsibilities:

- **Meta**: framework philosophy and maintenance guidance
- **Strategy**: directional constraints and policies
- **Design**: system/domain representation
- **Execution**: active workflow state and task contracts
- **Templates**: canonical structures for generated artifacts
- **Validation**: schemas, examples, and cross-check logic

Important:

- layer contents are configurable by project
- task-context files control what is actually loaded at runtime

## Context Loading Philosophy

Context loading is explicit and progressive.

General strategy:

1. load task baseline context
2. load item/plan-referenced context
3. load on-demand context only when a concrete ambiguity remains
4. stop when expected improvement becomes marginal

This keeps token usage controlled while preserving first-pass correctness.

## Human Control and Responsibility Split

The stakeholder owns:

- product direction
- framework direction
- acceptance decisions
- selection of follow-up scope from findings

Agents own:

- task execution within declared boundaries
- implementation and review reasoning
- producing structured artifacts required by the framework

Scripts own:

- deterministic mechanics and guardrails

## Workflow and Quality Separation

Framework quality and software runtime quality are intentionally separated.

This allows independent status signals for:

- software deployability (backend/renderer quality)
- framework integrity (contracts, scripts, task definitions)

## What Should Change vs Stay Stable

Stable:

- deterministic script-first mechanics
- end-to-end token efficiency objective
- structured contract + validation model

Configurable per project:

- concrete strategy/design document set
- exact schema shapes
- task-level context selections
- cross-file consistency rules

## Evolution Rules

Framework evolution should follow these rules:

- prefer additive, reversible changes
- update validation and examples together with contract changes
- avoid hidden coupling between scripts and hardcoded project document names
- keep meta docs concise and human-readable

## Summary

This framework is optimized for practical agentic engineering:

- scripts handle deterministic mechanics
- agents handle bounded reasoning
- YAML contracts provide structure
- validation prevents drift
- token efficiency is optimized over the full delivery loop, not per prompt

That combination is the foundation for sustainable, reusable AI-assisted development.

## Change Notes

- 2026-03-21: Rewritten to align with current script-first, YAML-first, validation-driven framework and project-agnostic task-context configuration model.
