# Plan: Strengthen Engineering Guardrails

## Item Reference

- Stable item id: `item-01`

## Goal Summary

Add project-specific maintainability rules to `agent/strategy/engineering-guardrails.md` so later implementation and review work has explicit guidance for thin entrypoints, clearer backend and renderer separation of concerns, and when large files should be split.

## Implementation Approach

- Extend `agent/strategy/engineering-guardrails.md` with a new maintainability-focused section or augment existing structure rules so the guidance is easy to find alongside other repository-wide constraints.
- Add Rust-specific rules that keep `main.rs` and comparable entrypoints thin, push business logic out of startup and transport layers, and define when large backend files should be broken into smaller modules.
- Add renderer TypeScript rules that keep the public renderer thin, separate UI orchestration from API/client and state concerns, and define when large renderer files or components should be split.
- Keep the wording tied to the current stack and topology from `agent/strategy/tech-stack.md` so the rules read as PumpBuddy constraints rather than generic style advice.

## Risks and Assumptions

- The document already contains architecture and boundary rules, so the new guidance should complement those sections without duplicating the tech stack or security documents.
- File-size or split triggers should stay qualitative enough to guide agents consistently without inventing hard thresholds the repository does not otherwise use.

## Validation Plan

- Review the updated guardrails for overlap or contradiction with existing repository, API, and runtime sections.
- Run `rg -n "entrypoint|separation|main\\.rs|renderer|large-file|split" agent/strategy/engineering-guardrails.md` to confirm the required concepts are present.

## Out of Scope

- Refactoring application code to comply with the new guardrails.
- Auditing the current codebase for every existing maintainability issue.

## Handoff Notes for Implementation

- Keep the plan lightweight and avoid changing the item’s scope or acceptance criteria.
- Prefer language that implementation and review agents can apply directly when deciding whether to split Rust or renderer TypeScript files.
