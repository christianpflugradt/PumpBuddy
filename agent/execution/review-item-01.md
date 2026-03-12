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
