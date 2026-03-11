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


## Review Acceptance

- Criteria Met: Renderer CI now runs `npm ci`, `npm run lint`, `npm run test -- --run`, and `npm run coverage:check` in the `renderer-quality` job for renderer changes; renderer coverage enforcement is implemented through `renderer/scripts/run-coverage.mjs` and documented in `renderer/package.json`; `npm ci`, `npm run lint`, and `npm run coverage:check` all succeed in `renderer/`.
- Evidence: `.github/workflows/ci-quality.yml` adds a `Verify coverage` step in the renderer job gated by renderer path changes; `renderer/package.json` exposes `test:coverage` and `coverage:check`; `renderer/scripts/run-coverage.mjs` executes Node's test runner with `--experimental-test-coverage` and thresholds of 80 for branches, functions, and lines; the committed `renderer/src/app.test.ts` coverage additions drive the current measured coverage to line 90.56%, branch 81.29%, functions 95.56%.
- Runtime/Build Check: `cd renderer && npm run coverage:check` -> exited 0, all 23 tests passed, coverage report showed `app.ts` line 90.56%, branch 81.29%, funcs 95.56%, satisfying the enforced 80% thresholds.
- Residual Risk: none identified
