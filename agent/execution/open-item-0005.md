# Publish coverage badges and quality usage docs

## Goal

Expose backend and renderer coverage status in the README together with concise documentation of the quality workflow entrypoint.

## Scope

- add backend and renderer coverage badges to the README
- document the primary local quality command and any essential prerequisites needed to run it
- keep the documentation concise and consistent with the actual repository tooling

## Acceptance Criteria

- the README displays one backend coverage badge and one renderer coverage badge using the chosen badge source for this repository
- the README documents the primary local quality command from the repository root
- the documented command text matches the executable tooling added in the repository
- a reviewer can verify the documentation by following the README command and observing the expected quality flow locally

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `README.md`

## Dependencies

- `item-0001`
- `item-0003`
- `item-0004`

## Out of Scope

- changing CI coverage thresholds
- adding new tests beyond what is needed to describe the workflow


## Review Findings

### Criterion

working badge/image links for the README coverage badges

- Status: fail
- Evidence: [README.md](/Users/cpf/Workspace/personal/PumpBuddy/README.md#L5) links the backend badge to `backend/target/llvm-cov/backend-coverage-summary.json`, but `git ls-files backend/target/llvm-cov/backend-coverage-summary.json renderer/src/app.test.ts README.md` only lists `README.md` and `renderer/src/app.test.ts`, and `git check-ignore -v backend/target/llvm-cov/backend-coverage-summary.json` reports the file is ignored by `.gitignore` via `**/target/`. That means the backend badge target is a local build artifact, not a repository-visible link a reviewer can follow from the README.
- Risk: The README presents a backend coverage badge whose target is broken outside a local checkout. That undermines the stated goal of exposing coverage status in repository documentation and fails the validation expectation for working badge links.

### Criterion

alignment with the plan constraint that badge values should be refreshable by current repository automation rather than requiring manual edits

- Status: fail
- Evidence: [README.md](/Users/cpf/Workspace/personal/PumpBuddy/README.md#L5) and [README.md](/Users/cpf/Workspace/personal/PumpBuddy/README.md#L6) hardcode `51.92%` and `94.56%` directly into static `img.shields.io` URLs. The only occurrences of those percentages in the repository are the README badge lines and the runtime output captured in [done-item-0004.md](/Users/cpf/Workspace/personal/PumpBuddy/agent/execution/done-item-0004.md#L62). [plan-item-0005.md](/Users/cpf/Workspace/personal/PumpBuddy/agent/execution/plan-item-0005.md#L21) explicitly says to avoid badge schemes that require manual edits after each run, but no committed script or workflow updates the README badges from `make check` or CI output.
- Risk: The badges will drift as soon as coverage changes, so the README will stop showing current backend and renderer coverage status even though the local quality command remains correct. This breaks the goal of publishing current coverage badges and creates documentation debt that has to be maintained manually.

### Additional Notes

- Executed `make check` from `/Users/cpf/Workspace/personal/PumpBuddy` and observed it exited 0. The run confirmed the documented command and prerequisites are accurate, including backend branch coverage output `51.92% (81/156)` and renderer overall line coverage `94.56%`.
