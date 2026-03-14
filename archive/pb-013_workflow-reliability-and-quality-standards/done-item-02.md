# Refocus Test Strategy

## Goal

Update the test strategy so it prioritizes meaningful confidence and durable test seams without weakening the hard backend branch-coverage signal.

## Scope

- update `agent/strategy/test-strategy.md` to state that meaningful tests matter more than threshold chasing
- preserve the hard backend branch-coverage gate as a repository signal rather than an optimization target
- clarify that backend persistence and PostgreSQL-backed behaviour should keep meaningful integration coverage

## Acceptance Criteria

- `agent/strategy/test-strategy.md` states that meaningful tests and maintainable test seams take priority over mechanical threshold chasing
- the updated strategy keeps backend branch coverage as a hard repository gate while clarifying that the metric does not define test value by itself
- the updated strategy explicitly preserves meaningful PostgreSQL-backed integration coverage for persistence behaviour
- `rg -n "meaningful|threshold|branch coverage|PostgreSQL|integration" agent/strategy/test-strategy.md` returns matches covering the updated policy

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`

## Out of Scope

- adding or changing tests in executable code
- changing the current coverage threshold in scripts or CI


## Review Acceptance

- Criteria Met: `agent/strategy/test-strategy.md` now prioritizes meaningful confidence and durable test seams over threshold chasing, keeps backend branch coverage as a hard repository gate rather than a definition of test value, and explicitly preserves meaningful PostgreSQL-backed integration coverage for persistence behavior.
- Evidence: Commit `faa2a18` adds the required policy language in usage guidance, testing goals, integration testing, test infrastructure, required-tests guidance, review expectations, and change notes; the diff is scoped to `agent/strategy/test-strategy.md` and matches the review item without altering out-of-scope scripts or thresholds.
- Runtime/Build Check: Executed `rg -n "meaningful|threshold|branch coverage|PostgreSQL|integration" agent/strategy/test-strategy.md` and observed matching lines covering all required policy areas, including threshold guidance, branch-coverage gate wording, and PostgreSQL-backed integration coverage.
- Residual Risk: none identified
