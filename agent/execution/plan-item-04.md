# Plan: Relax Mobile Numeric Input Validation

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Allow temporary intermediate numeric typing states in workout inputs on mobile, while ensuring values are normalized and validated at interaction completion boundaries so persisted workout data remains correct.

## Implementation Approach

- Update numeric input handling in `renderer/src/workout-render.ts` to accept transient intermediate states during active typing (for example empty strings or partial numeric text) without immediate reset.
- Add boundary normalization/validation paths that run on blur, save, and complete-set actions; ensure invalid or incomplete values are converted/rejected consistently at those points.
- Keep existing persistence and logging constraints intact by routing final values through a shared normalization helper before data write and workout-log-affecting actions.
- Preserve current UX and API expectations outside numeric-input flow; keep scope limited to mobile-first input interaction and related validation timing.

## Risks and Assumptions

- Assumes intermediate-state tolerance can be added without broad refactors to unrelated workout state management.
- Risk that delayed validation introduces edge cases for rapid action sequences (typing then immediate save/complete); mitigated by centralizing boundary checks.
- Assumes existing tests can be updated/extended in renderer test suite without introducing brittle timing-dependent assertions.

## Validation Plan

- Run `npm --prefix renderer run test` and confirm success.
- Manually verify numeric field behavior allows intermediate input during typing and normalizes on blur.
- Manually verify save and complete-set actions normalize/validate values and preserve expected logging correctness.

## Out of Scope

- Changes to backend validation rules or persistence schema.
- Broad workout UI redesign beyond numeric input validation timing.
- New API surface changes not required for input-handling behavior.

## Handoff Notes for Implementation

- Keep acceptance criteria authoritative and avoid expanding scope beyond recommendation 8 validation context.
- Prefer a single normalization pathway used by blur, save, and complete-set to avoid drift.
- Ensure final committed values remain numerically valid even when intermediate typing states are permissive.
