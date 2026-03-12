# Update Workout Use-Case Documentation

## Goal

Document the current workout behaviour so the use-case description matches the shipped multi-set flow and no longer treats Hello World as an active use case.

## Scope

- rewrite `agent/design/use-cases.md` to describe the current workout execution flow with per-set persistence, same-exercise set progression, read-only completed sets, and default recommendation behaviour
- remove or archive the active Hello World use-case description from the current-state documentation
- keep the documented user-facing copy assumptions aligned with the plan and English-only product rule

## Acceptance Criteria

- `agent/design/use-cases.md` describes multi-set workout execution, incremental persistence on set progression, and the non-editable status of earlier completed sets after advancement
- `agent/design/use-cases.md` no longer presents Hello World as an active current-state use case
- `sed -n '1,260p' agent/design/use-cases.md` shows the updated workout-only use-case content and no active Hello World use case

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `agent/design/api-contract.yaml`

## Dependencies

- `item-0002`
- `item-0003`

## Notes for Review

- Review should check that the document matches the implemented flow and does not drift back to the bootstrap terminology.
