# Plan: Publish coverage badges and quality usage docs

## Item Reference

- `agent/execution/open-item-0005.md`

## Goal Summary

Expose backend and renderer coverage status in the README and document the primary repository-root quality command so a reviewer can follow the documented workflow locally.

## Implementation Approach

- Inspect the committed backend and renderer coverage sources plus the repository-root quality entrypoint introduced by earlier items, then choose one badge format and source that can represent both coverage values consistently in the README.
- Update the README header or adjacent quality section to add one backend coverage badge and one renderer coverage badge without expanding the document into detailed CI documentation.
- Add a short local quality workflow section that names the primary root command, explains any essential prerequisites for coverage-related steps, and keeps the command text identical to the executable repository tooling.
- Keep wording aligned with existing CI and script names so the README documents the actual workflow rather than a parallel documentation-only command path.

## Risks and Assumptions

- This item depends on prior quality work, especially the repository-root entrypoint from `item-0004`; if that command is not yet present, implementation should document the actual committed command instead of inventing a new one here.
- Coverage badges are only useful if their source can be updated from the repository's current automation, so the chosen badge mechanism should match what the project can realistically publish.
- Backend coverage may depend on Docker-capable integration test execution or explicit local tooling such as `cargo llvm-cov`, so prerequisites must stay concise but explicit.

## Validation Plan

- Verify the README contains exactly one backend coverage badge and one renderer coverage badge with working badge/image links.
- Run the documented root quality command from the repository root in a supported local environment, or confirm it matches the executable tooling already defined for `item-0004`.
- Check that the README prerequisites cover any essential backend or renderer setup needed for the quality flow, especially coverage-related tooling assumptions.
- Confirm the documented command path is consistent with CI and repository scripts rather than duplicating command sequences inline.

## Out of Scope

- Changing backend or renderer coverage thresholds.
- Adding new quality checks or expanding CI scope beyond documenting the existing workflow.

## Handoff Notes for Implementation

- Keep the README change compact and reader-oriented: badges near the top, quality command documentation near existing developer workflow guidance.
- Prefer durable badge URLs that do not require manual editing after each coverage run if the repository automation already produces a suitable source.
