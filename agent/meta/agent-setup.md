# Agent Setup

## Purpose

This document defines **how the framework is wired** (scripts, state files, validation, CI).
Task semantics themselves are documented in `agent/meta/agent-tasks.md`.

## Runtime Wiring

Deterministic runtime contract:

- dispatcher: `agent/scripts/tasks.sh`
- task runners/finalizers: `agent/scripts/task/**`
- shared helpers: `agent/scripts/lib/**`
- checks: `agent/scripts/check/**`
- task context: `agent/execution/task-context/*.yaml`
- task spec: `agent/execution/task-spec/*.yaml`

Mode entry behavior is defined in `AGENTS.md`.

## Execution State Layout

Active execution state:

- `agent/execution/plan.yaml`
- `agent/execution/workflow-policy.yaml`
- `agent/execution/workflow-state.yaml`
- `agent/execution/open-item-XX.yaml`
- `agent/execution/review-item-XX.yaml`
- `agent/execution/done-item-XX.yaml`
- `agent/execution/plans/plan-item-XX.yaml`

Transient artifacts:

- `agent/tmp/**`

Archive output:

- `archive/**`

## Validation Wiring

Primary entrypoint:

- `agent/scripts/check/validate-docs.sh`

Validation stack includes:

- Pydantic schema validation for registered project contracts
- Pydantic schema validation for registered example contracts
- cross-file consistency checks for core design documents
- execution-item invariants (`open/review/done` filename-state consistency + schema)
- shell lint pass (`agent/scripts/check/shellcheck.sh`)

Additional checks:

- task contracts: `agent/scripts/check/check-task-contract.sh <task-name>`
- commit messages: `agent/scripts/check/check-commit-message.sh <message-file>`
- commit policy source: `agent/strategy/commit-policy.yaml`

## CI Separation

The repository keeps software quality and framework quality separate:

- `CI Quality` for backend/renderer runtime quality
- `Agent Framework Quality` for agent framework contracts and script hygiene

This separation keeps deployability status independent from framework drift status.

## Maintenance Rules

- keep operational contracts in YAML
- keep meta docs concise and human-readable
- update this file when wiring changes (scripts, checks, CI, state layout)
- update `agent-tasks.md` when task catalog/intent changes

## Change Notes

- 2026-03-21: Reduced to setup focus (how), aligned with current YAML-first framework and CI split.
