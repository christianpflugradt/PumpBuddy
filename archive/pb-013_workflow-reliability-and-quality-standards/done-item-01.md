# Strengthen Engineering Guardrails

## Goal

Codify the maintainability and modularity rules that later implementation and review items must follow.

## Scope

- update `agent/strategy/engineering-guardrails.md` with stronger rules for modular Rust and renderer TypeScript structure
- define expectations for thin entrypoints, clearer separation of responsibilities, and large-file refactoring triggers
- keep the guidance aligned with the current project tech stack and security boundaries

## Acceptance Criteria

- `agent/strategy/engineering-guardrails.md` explicitly defines maintainability expectations for thin entrypoints, separation of concerns, and when large Rust or renderer files must be split
- the updated guardrails mention both backend Rust structure and renderer TypeScript structure in project-specific terms rather than generic advice
- `rg -n "entrypoint|separation|main\\.rs|renderer|large-file|split" agent/strategy/engineering-guardrails.md` returns matches that demonstrate the new rules

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`

## Out of Scope

- reviewing the current codebase against the new rules
- refactoring production code


## Review Findings

### Criterion

Item scope stays limited to strengthening `agent/strategy/engineering-guardrails.md` and remains aligned with the declared goal and constraints.

- Status: fail
- Evidence: Commit `fc744e2` updates the target file as expected, but `git show --stat --summary fc744e2` also shows unrelated changes to `agent/meta/agent-setup.md`, `agent/scripts/finalize-review-accept-item.sh`, `agent/scripts/task-review-item.sh`, `agent/templates/review-accept-template.md`, `agent/templates/review-findings-template.md`, `badges/backend-coverage.json`, and `badges/backend-coverage.svg`. The item scope only calls for updating `agent/strategy/engineering-guardrails.md` with stronger modularity rules.
- Risk: Accepting this item would bless unrelated workflow and badge changes under a documentation-scoped review item, weakening deterministic review boundaries and making it harder to attribute or validate the extra changes against their own requirements.


## Review Acceptance

- Criteria Met: The item stays focused on strengthening `agent/strategy/engineering-guardrails.md`, explicitly adds thin-entrypoint, separation-of-concerns, and large-file split rules for both Rust backend and renderer TypeScript code, and satisfies the required keyword verification.
- Evidence: Relative to the pre-implementation baseline `fc744e2^`, the committed result at `a60a00c` changes only `agent/strategy/engineering-guardrails.md` plus the execution-item state file. The guardrails now explicitly cover `backend/src/main.rs` as a thin entrypoint, renderer entrypoints, separation between backend transport/business/persistence layers, separation between renderer presentation/orchestration/state/API code, and file-splitting triggers for both backend and renderer modules.
- Runtime/Build Check: `rg -n "entrypoint|separation|main\\.rs|renderer|large-file|split" agent/strategy/engineering-guardrails.md` returned matches at lines 106-118, 124, and 375, confirming the required rules are present in the committed file state.
- Residual Risk: none identified
