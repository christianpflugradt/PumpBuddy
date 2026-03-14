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
- Evidence: Runtime check of the README badge endpoint URL returned a Shields SVG with `aria-label="custom badge: resource not found"` and visible text `resource not found` for both backend and renderer badge links.
- Risk: The README still presents broken coverage badges to stakeholders, so the user-visible issue that triggered this item remains unresolved.

### Criterion

badge URL resolves successfully (no "resource not found")

- Status: fail
- Evidence: `curl --fail --silent --show-error --location --output /tmp/pumpbuddy-backend-badge.svg "https://img.shields.io/endpoint?url=https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json"` produced an SVG containing `resource not found`; same result for `renderer-coverage.json`.
- Risk: Badge consumers continue receiving error-state badges, which indicates publication/alignment is still not effective in the currently observable system state.

### Criterion

verification: confirm the badge URL returns a valid image after CI runs

- Status: fail
- Evidence: Executed runtime verification against both Shields endpoint URLs; both responses were valid SVG files but represented error badges (`custom badge: resource not found`) rather than coverage values.
- Risk: The required post-CI verification outcome is not met, so this item cannot be accepted as complete.
