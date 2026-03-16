# Pin Semantic-Release Toolchain in Repository Dependencies

## Goal

Make release automation deterministic by defining semantic-release and required plugins as pinned repository-managed dependencies with lockfile control.

## Scope

- add a repository-managed Node toolchain definition for semantic-release and required plugins with explicit versions
- generate and commit lockfile metadata that governs release-tool resolution
- keep release semantics aligned with existing `.releaserc.json` behavior
- avoid floating `npx -p` package resolution in release execution

## Acceptance Criteria

- semantic-release and required plugins are defined in version-controlled dependency metadata with explicit versions
- lockfile coverage exists for release-time dependency resolution
- release behavior remains compatible with current `.releaserc.json` rules
- executable verification: `npm ci` and `npx semantic-release --dry-run`

## References

- `agent/strategy/plan.md`
- `FINDINGS.technology.md`
- `.github/workflows/release.yml`
- `.releaserc.json`
- `agent/strategy/tech-stack.md`

## Out of Scope

- changing Conventional Commits policy
- redesigning release channel strategy
