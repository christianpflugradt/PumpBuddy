# Add renderer quality and coverage enforcement

## Goal

Establish a reliable renderer quality flow with test coverage measurement and CI threshold enforcement.

## Scope

- add or complete renderer quality tooling so linting, tests, and coverage run through repository-supported commands
- update the renderer portion of the CI quality workflow to enforce a pragmatic coverage threshold
- keep the renderer checks compatible with the current TypeScript and Vite-based setup

## Acceptance Criteria

- renderer CI runs linting, renderer tests, and renderer coverage for renderer changes
- the renderer coverage step fails when measured coverage drops below the agreed threshold defined in repository tooling
- `npm ci` succeeds in `renderer/` with the committed dependency state
- `npm run lint` succeeds in `renderer/`
- an executable renderer coverage verification command is documented in package scripts or CI tooling and succeeds in `renderer/`

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

## Out of Scope

- backend coverage enforcement
- README badge publication

## Notes for Review

- verify that renderer coverage is enforced through executable tooling, not only workflow prose
