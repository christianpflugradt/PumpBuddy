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

- `item-0001`

## Out of Scope

- adding coverage or release badges
- modifying product feature documentation unrelated to badges
