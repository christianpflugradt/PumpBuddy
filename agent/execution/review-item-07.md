# Align Optional Commit Scope Governance

## Goal

Define and align project and agent guidance so optional Conventional Commit scopes are restricted to the approved artifact-aligned set.

## Scope

- update `README.md` commit guidance to document optional scope usage and the exact allowed set: `renderer`, `backend`, `docker`, `database`, `api`, `deps`
- update `agent/strategy/engineering-guardrails.md` commit rules to match optional scope policy and prohibit type-overlapping or ad-hoc scopes
- ensure guidance explicitly keeps scope optional and compatible with existing commit type conventions

## Acceptance Criteria

- `README.md` includes commit guidance that states scope is optional and lists only `renderer`, `backend`, `docker`, `database`, `api`, `deps` as allowed scopes
- `agent/strategy/engineering-guardrails.md` enforces the same scope policy, including no overlap with commit types and no invented scopes
- running `git grep -nE "renderer|backend|docker|database|api|deps" README.md agent/strategy/engineering-guardrails.md` shows policy text anchored in both files

## References

- `agent/strategy/plan.md`
- `README.md`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-06`
