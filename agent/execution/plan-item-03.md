# Plan: Keep Renovate Compatible With Generation Workflow

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Confirm that OpenAPI generation commands and generated-output ignore rules do not prevent Renovate from discovering and updating relevant dependency files.

## Implementation Approach

- Review current Renovate coverage against dependency surfaces touched by generation workflow changes (`renovate.json`, `Makefile`, `renderer/package.json`, `backend/Cargo.toml`).
- Keep `renovate.json` unchanged when compatibility is already preserved; otherwise add only minimal config required to restore expected update behavior.
- If config changes are needed, document why they are necessary and limit them to generation-workflow compatibility.

## Risks and Assumptions

- Assume generated directories remain ignored and should not be scanned by Renovate as authoritative dependency sources.
- Risk of over-configuring Renovate in ways that alter broader policy; keep any change narrowly scoped to discovery compatibility.

## Validation Plan

- Validate Renovate schema after review/update (`renovate-config-validator renovate.json` or equivalent CI validation command).
- Confirm dependency targets remain discoverable via concrete checks on known files that Renovate should parse (`renovate.json`, `Makefile`, `renderer/package.json`, `backend/Cargo.toml`).
- Verify generation-related ignore behavior does not hide dependency declarations from Renovate by checking that dependency versions live in tracked source/config files rather than ignored generated outputs.

## Out of Scope

- Broad Renovate policy redesign unrelated to generation workflow compatibility.

## Handoff Notes for Implementation

- Preserve the existing item scope and acceptance criteria; do not expand into general dependency-management refactoring.
- Prefer explicit compatibility confirmation if no change is required, and include rationale when any Renovate config update is introduced.
