# Fix Coverage Badge Resource Not Found

## Goal

Ensure the coverage percentage badge is published and referenced correctly in the README so it renders instead of showing "resource not found".

## Scope

- identify the coverage badge generation/publish mechanism (workflow or service)
- fix the badge URL or publishing step so a valid badge image is available
- update README badge link if needed to match the published badge

## Acceptance Criteria

- README displays the coverage badge image correctly
- badge URL resolves successfully (no "resource not found")
- verification: confirm the badge URL returns a valid image after CI runs

## References

- `agent/strategy/plan.md`
- `README.md`
- `.github/workflows`

## Notes for Review

- Stakeholder observed the README badge showing "resource not found"; ensure badge publishing and URL are aligned.
