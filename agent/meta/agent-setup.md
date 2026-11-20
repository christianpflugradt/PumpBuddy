# Agent Setup

## Purpose

This document defines **how the framework is wired** (scripts, validation, CI).

## Runtime Wiring

- checks: `agent/scripts/check/**`
- contracts: `agent/design/*.yaml`, `agent/strategy/*.yaml`
- archive output: `archive/**`

## Validation Wiring

Primary entrypoint:

- `make check-framework`

Validation stack includes:

- Pydantic schema validation for registered project contracts
- Pydantic schema validation for registered example contracts
- cross-file consistency checks for core design documents

Additional checks:

- commit messages: the external commit-msg Rule Set in `.please/config.toml`
- commit policy source: `agent/strategy/commit-policy.yaml`

## CI Wiring

The main CI workflow has a single `Check` job for software and framework quality.
Coverage calculation and statistics publication live in the independent
`Statistics` workflow.

## Maintenance Rules

- keep operational contracts in YAML
- keep meta docs concise and human-readable
- update this file when wiring changes (scripts, checks, CI)

## Change Notes

- 2026-03-21: Reduced to setup focus (how), aligned with current YAML-first framework and CI split.
- 2026-11-20: Removed the task dispatcher, task scripts, execution state and templates.
