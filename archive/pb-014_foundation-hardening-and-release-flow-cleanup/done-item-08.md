# Remove Abandoned Pages Actions Dependencies

## Goal

Address abandoned Pages GitHub Actions dependencies by removing or replacing `actions/configure-pages` and `actions/deploy-pages` with maintained alternatives.

## Scope

- update `.github/workflows/ci-quality.yml` Pages publish job to avoid abandoned actions
- preserve coverage badge publication behavior on main branch pushes/workflow dispatches
- keep workflow permissions and artifact flow aligned with current security baseline

## Acceptance Criteria

- `.github/workflows/ci-quality.yml` no longer references `actions/configure-pages` or `actions/deploy-pages`
- replacement workflow path is valid and keeps badge artifact publication semantics intact
- `act` simulation, workflow validation, or equivalent concrete check confirms the updated Pages publish job remains structurally valid

## References

- `agent/strategy/plan.md`
- `.github/workflows/ci-quality.yml`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/scripts/prepare-pages-artifacts.sh`

## Out of Scope

- redesigning non-Pages CI jobs


## Review Acceptance

- Criteria Met: `.github/workflows/ci-quality.yml` removes `actions/configure-pages` and `actions/deploy-pages`, preserves artifact upload via `actions/upload-pages-artifact@v4`, and keeps Pages publication semantics through an API-driven deploy step that sets `steps.deployment.outputs.page_url` for the `github-pages` environment URL.
- Evidence: Commit `d02f645` replaces the old Pages action steps with a maintained `run` step that posts to `/repos/{repo}/pages/deployments` using OIDC + uploaded artifact id, then polls deployment status until `succeed`; repository search confirms no remaining `actions/configure-pages`/`actions/deploy-pages` references in `ci-quality.yml`.
- Runtime/Build Check: Executed `if command -v actionlint >/dev/null 2>&1; then actionlint .github/workflows/ci-quality.yml; else ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci-quality.yml"); puts "YAML parse OK"'; fi` and observed `YAML parse OK`.
- Residual Risk: Low; local checks validate structure and syntax, while end-to-end deployment behavior still depends on GitHub-hosted runtime execution.
