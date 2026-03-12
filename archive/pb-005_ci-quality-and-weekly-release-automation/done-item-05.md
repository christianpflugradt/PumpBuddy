# Item 0005 - Semantic-Release Rules Configuration

## Goal

Define semantic-release rules so version bumps and release notes follow the project policy.

## Scope

- add semantic-release configuration file(s) to the repository
- configure release type mapping: `BREAKING CHANGE` as major, `feat` as minor, `fix`/`perf`/`chore` as patch
- configure release-note generation to exclude docs-only changes from notes and release triggering

## Acceptance Criteria

- repository contains semantic-release configuration that encodes the required commit-to-version mapping
- docs-only commits are configured to produce no release and no release-note section
- executable verification:
  `rg -n "semantic-release|releaseRules|BREAKING CHANGE|feat|fix|perf|chore|docs" .releaserc* package.json`

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`

## Out of Scope

- scheduled workflow execution
- README badge updates


## Review Acceptance

- Criteria Met: The repository contains a root `.releaserc.json` with explicit semantic-release commit analysis rules for `BREAKING CHANGE` as major, `feat` as minor, `fix`/`perf`/`chore` as patch, and `docs` as no release; release-notes generation also marks `docs` as hidden so docs-only commits do not appear in generated notes.
- Evidence: `.releaserc.json` configures `@semantic-release/commit-analyzer` with `releaseRules` for `breaking`, `feat`, `fix`, `perf`, `chore`, and `docs`, and configures `@semantic-release/release-notes-generator` with `presetConfig.types` that hide `docs`. This matches the item scope and the plan constraint allowing a standalone semantic-release config when no root `package.json` exists.
- Runtime/Build Check: Executed `node -e "JSON.parse(require('fs').readFileSync('.releaserc.json', 'utf8')); console.log('valid .releaserc.json')"` from the repository root; result: exit code 0 and output `valid .releaserc.json`.
- Residual Risk: The acceptance criterion's suggested `rg ... package.json` command currently exits non-zero because the repository has no root `package.json`, but this does not affect the semantic-release configuration itself.
