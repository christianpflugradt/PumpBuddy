# Migrate Execution Items To Two-Digit IDs

## Goal

Convert execution item naming and supporting automation from variable-width/four-digit examples to a consistent two-digit identifier format.

## Scope

- update execution item templates, examples, and supporting validation/finalization scripts to use two-digit IDs consistently
- migrate relevant backlog or archive artifacts that still encode four-digit item examples where repository content should reflect the new convention
- preserve filename-based item state handling while tightening validation around the two-digit format

## Acceptance Criteria

- repository templates and agent automation examples use `open-item-01.md` style identifiers instead of four-digit examples
- execution-state validation rejects non-two-digit item filenames once the migration is complete
- `sh agent/scripts/validate-execution-state.sh` succeeds against the migrated repository state
- any touched archive or backlog references remain internally consistent after the rename/update pass

## References

- `agent/strategy/plan.md`
- `agent/templates/item-template.md`
- `agent/templates/plan-item-template.md`
- `agent/meta/rationale.md`
- `agent/scripts/validate-execution-state.sh`
- `agent/scripts/finalize-plan-item.sh`
- `agent/scripts/finalize-implement-item.sh`

## Out of Scope

- changing the semantic meaning of item states or adding new item states
