# Extended Review Findings

Review Task: review-technology

Summary:

- 2 findings identified
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

## Implementation Direction (Agreed)

Adopt Vitest as the single renderer unit-test runner and coverage source of truth; remove Node test-runner usage from renderer quality scripts.

## Scope

- introduce and configure Vitest for renderer unit tests
- migrate current renderer test and coverage scripts from Node test-runner usage to Vitest commands
- keep current test intent and coverage thresholds equivalent after migration
- ensure CI quality jobs execute the same Vitest-based commands used locally

## Acceptance Criteria

- renderer unit tests run through Vitest in local scripts and CI
- renderer coverage reporting is produced by Vitest and preserves existing quality gates
- legacy Node test-runner specific flags are removed from renderer testing scripts
- renderer contributor documentation references Vitest commands as the canonical test flow

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

## Implementation Direction (Agreed)

Adopt repository-managed pinned release dependencies (Option A) with lockfile control, and run semantic-release from that pinned toolchain in CI.

## Scope

- define semantic-release and plugins in repository-managed Node dependencies with lockfile coverage
- update the release workflow to run the pinned toolchain instead of floating `npx -p` installs
- preserve existing release behavior and Conventional Commits analysis semantics
- document dependency update procedure for release tooling to keep upgrades explicit and reviewable

## Acceptance Criteria

- release workflow uses deterministic semantic-release package versions from version-controlled dependency metadata
- release runs are reproducible across executions unless explicit dependency updates are merged
- release behavior remains compatible with current `.releaserc.json` rules

## References

- `.github/workflows/release.yml`
- `.releaserc.json`
- `agent/strategy/tech-stack.md`
<!-- END FINDING -->
