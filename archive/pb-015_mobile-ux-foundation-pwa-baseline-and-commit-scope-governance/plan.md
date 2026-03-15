# Plan: Mobile UX Foundation, PWA Baseline, and Commit Scope Governance

## Plan ID

pb-015

## Goal

Improve core mobile workout usability with the highest-impact UI/UX changes while establishing a minimal installable PWA baseline and a strict, optional conventional commit scope policy that agents consistently follow.

## Scope

- implement the first 5 recommendations from `MOBILE_FIRST_UI_UX_REVIEW.md` in listed priority order
- keep implementation grounded in `MOBILE_FIRST_UI_UX_REVIEW.md` details so recommendation intent is preserved during execution
- deliver a minimal PWA baseline for the renderer (installable app shell) without offline behavior
- define and document optional allowed commit scopes aligned to deployed artifact locations: `renderer`, `backend`, `docker`, `database`, `api`, `deps`
- update project and agent guidance so commit scopes are optional, non-overlapping with commit types, and never invented outside the allowed set

## Out of Scope

- any offline-first or runtime caching strategy (service worker caching, sync queues, background sync)
- UI/UX recommendations 6+ from `MOBILE_FIRST_UI_UX_REVIEW.md` unless needed as a direct dependency for items 1-5
- adding commit scopes that correspond to commit types (`ci`, `build`, `docs`, etc.)
- forcing a scope on every commit

## Success Criteria

- the first 5 recommendations from `MOBILE_FIRST_UI_UX_REVIEW.md` are implemented and traceable in execution items
- renderer can be installed as a PWA with manifest and required static assets correctly served in the containerized runtime
- no offline behavior is introduced as part of this plan
- README commit guidance documents the allowed optional scope set exactly as `renderer`, `backend`, `docker`, `database`, `api`, `deps`
- agent behavior guidance enforces the same scope set and rules: scope optional, no type overlap, no ad-hoc scopes

## Constraints

- keep this plan to a practical refinement size target of 4-8 execution items
- prioritize review recommendations strictly by source order and cap UI/UX scope at the first 5 items for this plan
- preserve existing architecture boundaries (renderer/backend/database) while implementing changes
- commit scope governance must stay compatible with existing conventional commit type usage

## Inputs

- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `README.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/plan.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
