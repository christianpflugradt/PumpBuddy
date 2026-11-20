# Framework Verification Inventory

## Purpose

This file is the completeness-oriented inventory of all framework verifications.
Use it to check whether the framework still enforces all intended guards.

## Canonical Entrypoints

Primary local entrypoint:

- `make check-framework`

Additional targeted checks:

- External commit-msg rules in `.please/config.toml`

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

### 3) Commit Message Policy

External Conventional Commits and advisory header review run at commit-msg.
`.please/config.toml` pins the shared package; `.please/commit-scopes.txt` supplies
project scopes. No local header constraints, range or PR-title checks remain.

## CI Coverage

`.github/workflows/ci.yml` runs `framework` inside `check` / `Check`, . `.github/workflows/statistics.yml` independently calculates
and publishes statistics.

## Not Covered by This Inventory

This inventory is framework-focused only.
Software runtime quality belongs to backend/renderer Rules in `Check`.

## Maintenance Rule

Whenever a new framework check is introduced, changed, or removed:

1. update this inventory
2. update script/CI wiring
3. verify local and CI behavior are aligned

## Change Notes

- 2026-03-21: Initial completeness inventory introduced.
