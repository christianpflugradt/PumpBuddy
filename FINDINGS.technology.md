# Extended Review Findings

Review Task: review-technology

Summary:

- 3 findings identified
- overall readiness: follow-up work recommended before acceptance

<!-- FINDING -->
# Renderer unit-test tooling does not follow the defined Vitest baseline
Priority: P1

## Summary

The renderer unit-test workflow uses Node's built-in test runner instead of the project baseline tool (Vitest). This creates stack drift from the declared frontend testing standard and increases maintenance risk when tasks assume the documented tooling baseline.

## Evidence

- `agent/strategy/tech-stack.md` defines `Vitest` as the frontend unit-level testing technology.
- `renderer/scripts/run-tests.mjs` executes tests via `node --test`.
- `renderer/scripts/run-coverage.mjs` executes coverage via `node --test --experimental-test-coverage`.
- `renderer/package.json` does not include `vitest` in dependencies and does not expose a Vitest-based test command.

## Goal

Align renderer unit-test and coverage execution with the declared Vitest testing baseline.

## Scope

- introduce and configure Vitest for renderer unit tests
- migrate current renderer test and coverage scripts from Node test-runner usage to Vitest commands
- keep current test intent and coverage thresholds equivalent after migration

## Acceptance Criteria

- renderer unit tests run through Vitest in local scripts and CI
- renderer coverage reporting is produced by Vitest and preserves existing quality gates
- legacy Node test-runner specific flags are removed from renderer testing scripts

## References

- `agent/strategy/tech-stack.md`
- `renderer/package.json`
- `renderer/scripts/run-tests.mjs`
- `renderer/scripts/run-coverage.mjs`
<!-- END FINDING -->

<!-- FINDING -->
# Release workflow resolves semantic-release tooling without pinned versions
Priority: P2

## Summary

The release workflow installs semantic-release packages through floating `npx -p` resolution on every run. This bypasses lockfile-governed reproducibility and can introduce unreviewed major-version behavior changes, conflicting with the compatibility policy to align versions with repository tooling configuration and avoid unnecessary major upgrades.

## Evidence

- `.github/workflows/release.yml` runs `npx --yes -p semantic-release -p @semantic-release/commit-analyzer -p @semantic-release/release-notes-generator -p @semantic-release/github ...` without explicit versions.
- The repository has no root Node lockfile governing these release-time package resolutions.
- `agent/strategy/tech-stack.md` requires version decisions to align with lockfiles/toolchain files and to avoid major upgrades unless required by the task.

## Goal

Make release-tooling resolution deterministic and policy-aligned by pinning semantic-release package versions through repository-managed dependency configuration.

## Scope

- define semantic-release and plugins in repository-managed Node dependencies with lockfile coverage
- update the release workflow to run the pinned toolchain instead of floating `npx -p` installs
- preserve existing release behavior and Conventional Commits analysis semantics

## Acceptance Criteria

- release workflow uses deterministic semantic-release package versions from version-controlled dependency metadata
- release runs are reproducible across executions unless explicit dependency updates are merged
- release behavior remains compatible with current `.releaserc.json` rules

## References

- `.github/workflows/release.yml`
- `.releaserc.json`
- `agent/strategy/tech-stack.md`
<!-- END FINDING -->

<!-- FINDING -->
# End-to-end test tooling baseline (Playwright) is not present in implementation or CI
Priority: P3

## Summary

The technology baseline calls for selected end-to-end coverage with Playwright, but the current repository has no Playwright dependency, configuration, or CI execution path. This is a technology-adherence gap for the documented system-test layer.

## Evidence

- `agent/strategy/tech-stack.md` lists `Playwright for selected end-to-end tests` under system or end-to-end testing.
- Repository search shows no Playwright configuration, scripts, or workflow execution steps.
- `.github/workflows/ci-quality.yml` runs backend and renderer unit/integration quality only, with no e2e stage.

## Goal

Introduce a minimal Playwright-based e2e slice that validates at least one critical user workflow and is integrated into the quality process.

## Scope

- add Playwright dependency and baseline configuration for this repository
- implement a small, high-value e2e scenario (for example auth gate plus workout start flow)
- wire e2e execution into local quality commands and CI with pragmatic runtime bounds

## Acceptance Criteria

- repository includes Playwright config and executable e2e tests
- at least one critical end-to-end workflow is covered and passing in CI
- e2e job/docs are integrated without materially slowing normal contributor flow beyond agreed limits

## References

- `agent/strategy/tech-stack.md`
- `.github/workflows/ci-quality.yml`
- `renderer/package.json`
<!-- END FINDING -->

