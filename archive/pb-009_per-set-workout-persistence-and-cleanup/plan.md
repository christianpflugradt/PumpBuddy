# Plan: Per-Set Workout Persistence And Cleanup

## Plan ID

pb-009

## Goal

Enable per-exercise multi-set workout tracking with low-friction defaults, incremental persistence of completed sets, and cleanup of obsolete Hello World bootstrap behaviour and documentation.

## Scope

- persist per-set workout data including load and reps instead of relying on dummy single-set values
- keep one screen per exercise and show completed sets for the current exercise as read-only history within that screen
- prefill new set inputs from workout history when available, otherwise default to `10 kg` and `10` reps
- when starting a later set within the same exercise, prefill from the immediately previous set
- allow the user to adjust suggested load and reps up or down before confirming a set
- persist a completed set when the user starts the next set or advances to the next exercise
- treat earlier sets in the current exercise and earlier exercises in the workout as non-editable once the user has advanced past them
- remove remaining Hello World API and product remnants that no longer belong to the active workout slice
- update the use case documentation so it reflects the current product behaviour instead of the old bootstrap flow

## Out of Scope

- editing previously completed sets after the user has advanced to a later set or exercise
- editing data from earlier exercises after the user has moved on
- advanced progression logic beyond simple reuse of historical or immediately previous set values
- workout history or analytics views
- automatic recommendation of how many sets the user should perform
- localization beyond English

## Success Criteria

- the workout flow persists each completed set with its own load and reps rather than a shared dummy exercise value
- if historical data exists, the first set of an exercise starts from that prior recommendation; otherwise it starts from `10 kg` and `10` reps
- when the user starts another set in the same exercise, the new set begins with the previous set's values and remains adjustable
- advancing to a new set or the next exercise persists the last completed set without requiring extra confirmation screens
- completed sets remain visible but non-editable after the user advances
- the application no longer exposes the obsolete Hello World bootstrap endpoint or UI path
- the use case documentation describes the current workout behaviour and no longer treats Hello World as an active use case

## Constraints

- the workout flow remains one screen per exercise
- user-facing copy remains in English
- persistence behaviour may include exercise-level metadata updates when needed by the existing domain model, but should avoid unnecessary complexity
- the plan should stay a pragmatic single slice and not expand into broader workout history or editing workflows

## Inputs

- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
