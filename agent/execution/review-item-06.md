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
