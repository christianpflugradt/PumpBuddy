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


## Review Acceptance

- Criteria Met: `README.md` states scope is optional and restricts allowed scopes to `renderer`, `backend`, `docker`, `database`, `api`, `deps`; `agent/strategy/engineering-guardrails.md` enforces the same allowed set and explicitly forbids type-overlapping or ad-hoc scopes.
- Evidence: `README.md:126`-`README.md:136` and `agent/strategy/engineering-guardrails.md:345`-`agent/strategy/engineering-guardrails.md:349` match the item policy; `git grep -nE "renderer|backend|docker|database|api|deps" README.md agent/strategy/engineering-guardrails.md` returns matches in both files including policy anchors at `README.md:128`-`README.md:133` and `agent/strategy/engineering-guardrails.md:346`.
- Runtime/Build Check: Executed `agent/scripts/run-quality.sh changed`; observed result `No changed files detected for quality scope: worktree` (successful execution for this docs-only change).
- Residual Risk: none identified.
