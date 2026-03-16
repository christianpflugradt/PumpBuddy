# Run Release Workflow with Pinned Toolchain

## Goal

Update the GitHub release workflow to execute semantic-release from repository-managed pinned dependencies instead of floating package resolution.

## Scope

- modify `.github/workflows/release.yml` to install and run semantic-release from pinned repository dependencies
- remove floating `npx -p` package resolution from the release workflow
- preserve current release trigger behavior and plugin execution semantics
- keep workflow reproducibility aligned with lockfile-governed installs

## Acceptance Criteria

- release workflow no longer uses floating `npx -p` package installs for semantic-release plugins
- workflow executes semantic-release from repository-managed pinned dependencies
- workflow remains compatible with existing release configuration and trigger behavior
- executable verification: `gh workflow run release.yml` (or dry-run equivalent in CI context)

## References

- `agent/strategy/plan.md`
- `FINDINGS.technology.md`
- `.github/workflows/release.yml`
- `.releaserc.json`
- `agent/strategy/tech-stack.md`

## Dependencies

- `item-10`

## Out of Scope

- introducing new release plugins
- changing repository branching strategy
