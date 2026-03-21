# Framework Verification Inventory

## Purpose

This file is the completeness-oriented inventory of all framework verifications.
Use it to check whether the framework still enforces all intended guards.

## Canonical Entrypoints

Primary local entrypoint:

- `agent/scripts/check/validate-docs.sh`

Additional targeted checks:

- `agent/scripts/check/check-task-contract.sh <task-name>`
- `agent/scripts/check/check-commit-message.sh <message-file>`
- `agent/scripts/check/shellcheck.sh`
- `agent/scripts/check/check-execution-items.sh`

## What Is Verified

### 1) Contract Schema Validation (Pydantic)

Entrypoint:

- `python3 -m validation.core.validate`

Scope:

- all registered project contracts in `validation/models/__init__.py` (paths under `agent/**`)
- all registered examples in `validation/examples/**`

Failure mode:

- missing file
- schema mismatch
- unknown fields (strict models)
- missing required fields

### 2) Cross-File Design Consistency

Implemented in:

- `validation/core/checks.py`

Current checks:

- lifecycle policy consistency across glossary/domain/persistence
- workout mode consistency across glossary/domain value set
- capability ID consistency (glossary vs capabilities)
- use-case ID consistency (glossary vs use-cases)
- use-case mapping coverage consistency
- mapping references to unknown domain entities
- mapping modes outside allowed mode set
- persistence-impact targets that do not map cleanly to tables (warnings)

### 3) Execution Item State Invariants

Entrypoint:

- `agent/scripts/check/check-execution-items.sh`

Checks:

- filename pattern: `<status>-item-XX.yaml`
- `item.status_hint` matches filename status
- no conflicting states for same item id
- item file schema validity against `item-template` model

### 4) Shell Script Lint

Entrypoint:

- `agent/scripts/check/shellcheck.sh`

Scope:

- `.githooks/*.sh`
- `agent/scripts/**/*.sh`

Behavior:

- local: warns and skips when `shellcheck` is not installed
- CI (`Agent Framework Quality`): installs shellcheck and fails on lint findings

### 5) Task Contract Integrity

Entrypoint:

- `agent/scripts/check/check-task-contract.sh <task-name>`

Checks:

- task spec file exists
- script contract paths exist (dispatcher, task script, finalize script, context config)
- task name in task-spec and task-context matches

### 6) Commit Message Policy

Entrypoint:

- `agent/scripts/check/check-commit-message.sh <message-file>`

Policy source:

- `agent/strategy/commit-policy.yaml`

Checks:

- conventional-commit first-line format
- allowed commit types
- allowed scopes
- scope must not equal type
- minimal subject length

## CI Coverage

Workflow:

- `.github/workflows/agent-framework-quality.yml`

Separate CI jobs:

- `Pydantic Contracts`
- `Execution Item Invariants`
- `Shellcheck`
- `Task Contracts`

## Not Covered by This Inventory

This inventory is framework-focused only.
Software runtime quality (backend/renderer tests, lint, coverage, performance smoke) belongs to `CI Quality`.

## Maintenance Rule

Whenever a new framework check is introduced, changed, or removed:

1. update this inventory
2. update script/CI wiring
3. verify local and CI behavior are aligned

## Change Notes

- 2026-03-21: Initial completeness inventory introduced.
