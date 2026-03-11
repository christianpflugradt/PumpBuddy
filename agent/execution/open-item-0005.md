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
