# Add Per-Set Workout Persistence And Suggestions

## Goal

Enable the backend to persist completed workout sets individually and return the recommendation data needed to start the next set or a future workout exercise with sensible defaults.

## Scope

- update the backend workout request and response models so active-workout persistence represents multiple completed sets per exercise instead of a single mutable set value
- add backend logic that derives the next suggested load and reps from the immediately previous set in the same exercise or, when no current-set history exists, from the latest historical workout set for that exercise
- preserve the fallback recommendation of `10 kg` and `10` reps when no historical set exists
- add or update backend tests that cover per-set persistence and recommendation selection

## Acceptance Criteria

- the active-workout backend persists each completed set as a distinct `WorkoutSet` record with its own `set_index`, load, and reps instead of replacing earlier sets
- the active-workout API response includes enough data for the renderer to show completed sets as read-only history and to prefill the next editable set from backend-provided suggestions
- when no prior workout history exists for an exercise, the backend suggestion defaults to `10 kg` and `10` reps
- `cargo test --manifest-path backend/Cargo.toml` passes

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/design/domain-model.md`
- `agent/design/api-contract.yaml`

## Notes for Review

- Review should confirm that persistence remains SQLx-based and that earlier completed sets stay represented as immutable history in backend responses.
