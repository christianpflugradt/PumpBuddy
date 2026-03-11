# Plan: README License and CI Badges

## Item Reference

- `agent/execution/open-item-0007.md`

## Goal Summary

Add license and CI status badges near the top of `README.md` using the repository's existing `LICENSE` file and CI quality workflow.

## Implementation Approach

- inspect the README header area and insert both badges directly below the main title so they remain visible without changing unrelated sections
- point the license badge at the repository `LICENSE` file and use badge markup that reflects the actual license declared there
- point the CI badge at `.github/workflows/ci-quality.yml` and use the workflow name or path that matches the configured GitHub Actions workflow
- keep the README text aligned with the current workflow naming if any nearby wording needs a small adjustment for consistency

## Risks and Assumptions

- badge URLs depend on the GitHub repository path being consistent with the current remote naming convention
- the README currently has no header badges, so placement should avoid disturbing existing introductory copy

## Validation Plan

- verify `README.md` contains both badge links near the top of the document
- run `rg -n "\\[!\\[License\\]|\\[!\\[CI\\]|workflows/ci-quality.yml" README.md` to confirm the expected badge markup and workflow reference

## Out of Scope

- adding any badges other than license and CI status
- broader README restructuring or feature-documentation edits unrelated to badge placement

## Handoff Notes for Implementation

- keep the change limited to `README.md` unless a repository metadata mismatch forces clarification
- prefer stable Markdown badge links over generated HTML so the README remains easy to maintain
