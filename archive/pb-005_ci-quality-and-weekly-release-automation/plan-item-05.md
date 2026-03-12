# Plan: Item 0005 - Semantic-Release Rules Configuration

## Item Reference

- `agent/execution/open-item-05.md`

## Goal Summary

Add repository-level semantic-release configuration that applies the required Conventional Commit release mapping and ensures docs-only commits neither trigger releases nor appear in generated release notes.

## Implementation Approach

- Inspect the current release automation entry points to confirm whether semantic-release should be configured through a new root `.releaserc` file or another repository-level config location.
- Add a semantic-release configuration that defines release rules for `BREAKING CHANGE` as major, `feat` as minor, and `fix`, `perf`, and `chore` as patch.
- Configure commit analysis and release-notes generation so `docs` commits are ignored for both version bumps and release-note sections.
- Keep the change limited to release configuration and any minimal package metadata needed to make the configuration discoverable by existing automation.

## Risks and Assumptions

- The repository may not yet have a root Node package manifest, so the implementation should prefer a standalone semantic-release config file unless existing automation clearly expects `package.json`.
- semantic-release plugin defaults must be checked carefully so docs-only commits are excluded from both release triggering and notes, not just from version calculation.
- If CI or release workflows reference a specific config path, the implementation should align with that convention rather than introducing parallel configuration.

## Validation Plan

- Run:
  `rg -n "semantic-release|releaseRules|BREAKING CHANGE|feat|fix|perf|chore|docs" .releaserc* package.json`
- Review the resulting config to confirm docs commits map to no release and are omitted from generated release-note sections.

## Out of Scope

- scheduled release workflow execution
- release pipeline credential setup
- README or badge updates

## Handoff Notes for Implementation

- Prefer explicit semantic-release plugin configuration over relying on implicit defaults where the required commit mapping or docs exclusion would otherwise be ambiguous.
- Keep the configuration readable and close to semantic-release conventions so later release workflow wiring can consume it without additional restructuring.
