# Automate Plan Tag Creation On Finalize

## Goal

Update the plan finalization workflow so future finalized plans automatically create the matching plan-ID git tag, starting with `pb-011`.

## Scope

- add plan-tag creation to the finalize-plan automation at the correct point in the archive flow
- fail safely when the target plan tag already exists or when the plan ID cannot be determined reliably
- keep the automation compatible with the existing plan archive process

## Acceptance Criteria

- finalizing a plan with ID `pb-011` would create a matching git tag `pb-011` as part of the finalize flow
- `agent/scripts/finalize-plan.sh` exits with a clear error instead of silently overwriting an existing plan tag
- the finalize script still archives the plan and prepares the next plan file when run under normal conditions
- `sh agent/scripts/finalize-plan.sh` still passes its usage expectations for zero arguments

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/scripts/finalize-plan.sh`

## Dependencies

- `item-05`

## Out of Scope

- tagging non-plan milestones or release versions


## Review Acceptance

- Criteria Met: All acceptance criteria are satisfied. `agent/scripts/finalize-plan.sh` now checks for an existing `refs/tags/<plan-id>` before mutating files, creates the matching annotated plan tag during successful finalization, preserves the archive-and-next-plan flow, and continues to run as a zero-argument command.
- Evidence: Commit `233eec4` adds a preflight duplicate-tag guard (`exit 16` with `Plan tag already exists: <plan-id>`), creates `git tag -a "${PLAN_ID}" -m "Plan ${PLAN_ID}"` after the archive commit, switches push behavior to `git push --follow-tags`, and emits `PLAN_TAG=${PLAN_ID}`. In an isolated git repo using the committed script, finalizing a `pb-011` plan archived `agent/strategy/plan.md`, created `archive/pb-011_quality-hardening-and-workflow-reliability/plan.md`, advanced the active template plan to `pb-012`, and created tag `pb-011` pointing at the finalize commit. A separate isolated run with a pre-existing `pb-011` tag exited with `RC=16`, printed `Plan tag already exists: pb-011`, and left both the archive directory absent and the original plan file in place.
- Runtime/Build Check: Executed an isolated end-to-end shell harness that initialized a temporary git repo plus bare remote, copied in `agent/scripts/finalize-plan.sh`, then ran `sh agent/scripts/finalize-plan.sh`; observed `SUCCESS_STATUS=0`, `PLAN_ARCHIVED=archive/pb-011_quality-hardening-and-workflow-reliability`, `NEXT_PLAN_ID=pb-012`, `PLAN_TAG=pb-011`, and `TAG_TARGET` matching `HEAD`. Executed a second isolated harness with an existing `pb-011` tag; observed `RC=16`, `Plan tag already exists: pb-011`, `ARCHIVE_EXISTS=no`, and `PLAN_STILL_PRESENT=yes`.
- Residual Risk: none identified
