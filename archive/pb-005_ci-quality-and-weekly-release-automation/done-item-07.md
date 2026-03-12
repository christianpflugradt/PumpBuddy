# Item 0007 - README License and CI Badges

## Goal

Show current license and CI status in the README header.

## Scope

- add a license badge to `README.md`
- add a CI status badge linked to the quality workflow
- keep README wording aligned with the current repository workflows and license

## Acceptance Criteria

- `README.md` contains both a license badge and a CI badge near the top of the document
- CI badge points to the configured CI workflow
- executable verification:
  `rg -n "\\[!\\[License\\]|\\[!\\[CI\\]|workflows/ci-quality.yml" README.md`

## References

- `agent/strategy/plan.md`
- `README.md`

## Dependencies

- `item-01`

## Out of Scope

- adding coverage or release badges
- modifying product feature documentation unrelated to badges


## Review Acceptance

- Criteria Met: `README.md` contains both a license badge and a CI badge at the top of the document, and the CI badge links to the configured `.github/workflows/ci-quality.yml` workflow.
- Evidence: [README.md](/Users/cpf/Workspace/personal/PumpBuddy/README.md#L3) includes the license badge on line 3 and the CI badge on line 4; [ci-quality.yml](/Users/cpf/Workspace/personal/PumpBuddy/.github/workflows/ci-quality.yml#L1) exists and defines the CI Quality workflow referenced by the badge URL.
- Runtime/Build Check: Executed `rg -n "\\[!\\[License\\]|\\[!\\[CI\\]|workflows/ci-quality.yml" README.md` and observed matches on lines 3 and 4 for both badges plus the `workflows/ci-quality.yml` target.
- Residual Risk: none identified
