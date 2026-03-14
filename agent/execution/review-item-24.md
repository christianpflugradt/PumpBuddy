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




## Review Findings

### Criterion

README displays the coverage badge image correctly

- Status: fail
- Evidence: `README.md` links badge endpoints to `https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json` and `.../renderer-coverage.json`, and runtime checks of both Shields URLs returned SVGs with `aria-label="custom badge: resource not found"`.
- Risk: Stakeholders still see broken coverage badges in the README, so the user-visible issue remains unresolved.

### Criterion

badge URL resolves successfully (no "resource not found")

- Status: fail
- Evidence: `curl --fail --silent --show-error --location "https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json"` and the same renderer URL both returned HTTP 404; corresponding Shields endpoint calls returned `resource not found` badges.
- Risk: Badge consumers cannot retrieve valid coverage endpoint JSON, so the publication/alignment mechanism is still ineffective.

### Criterion

verification: confirm the badge URL returns a valid image after CI runs

- Status: fail
- Evidence: Executed runtime verification against both README badge links and both JSON endpoints; the JSON endpoints returned 404 and badge images rendered as error-state `resource not found`.
- Risk: The acceptance verification outcome is not met, so the item cannot be accepted.
