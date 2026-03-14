# Plan: Replace Committed Coverage Badge Artifacts

## Item Reference

- Stable item id: `item-04`

## Goal Summary

Move coverage badge publication away from committed generated badge files and onto a GitHub Pages plus Shields endpoint flow so local and CI quality checks no longer depend on badge artifact freshness in git.

## Implementation Approach

- inventory the current backend and renderer coverage scripts, README badge links, and quality-artifact freshness checks to isolate every place that assumes committed `badges/*.json` and `badges/*.svg`
- change backend and renderer coverage generation so local quality commands still compute and validate coverage thresholds but write Pages-publishable JSON artifacts instead of requiring tracked badge files in the repository
- update repository automation so badge publication is handled by an explicit script or workflow path that can prepare the Pages artifacts for `christianpflugradt/PumpBuddy`, while `agent/scripts/run-quality.sh check` stops snapshotting and verifying committed badge outputs
- switch README coverage badges to Shields endpoint URLs backed by the default GitHub Pages location and add concise repository documentation near the scripts or workflow so regeneration and publication steps are discoverable

## Risks and Assumptions

- GitHub Pages publication may require introducing or updating a workflow and output directory convention that is not yet present in the repository
- local quality commands still need deterministic coverage parsing even if badge publication moves out of the main `check` flow
- the implementation should preserve existing backend branch and renderer coverage thresholds while changing only publication and freshness behavior

## Validation Plan

- run `sh agent/scripts/run-quality.sh check` and confirm it no longer fails because badge artifacts changed during the run
- verify the backend and renderer coverage scripts still fail correctly when coverage output is malformed or below threshold
- confirm README badge URLs resolve to the expected Pages plus Shields pattern for `https://christianpflugradt.github.io/PumpBuddy/`

## Out of Scope

- changing backend branch coverage minimums
- broader README redesign beyond coverage badge source updates

## Handoff Notes for Implementation

- keep the plan lightweight: reuse existing coverage parsing and badge-writing logic where possible instead of redesigning threshold checks
- prefer an encoded publication path in repository scripts or workflows over undocumented manual Pages steps
