# Backend persistence remains concentrated in a single cross-cutting repository file

## Summary

The backend persistence layer is still concentrated in one 1,288-line `persistence.rs` file that owns unrelated read paths, workout lifecycle writes, active-workout recovery, mapping, and embedded tests, which keeps it as the default landing place for unrelated changes.

## Evidence

- `wc -l backend/src/persistence.rs` reports 1,288 lines.
- `backend/src/persistence.rs:36-153` loads a full training-plan aggregate, while `156-236` handles plan and gym summary reads.
- `backend/src/persistence.rs:320-697` owns active-workout mutation and recovery behavior in the same module.
- `backend/src/persistence.rs:940-1245` embeds repository tests in the same oversized file, further increasing the cost of change.
- The current structure conflicts with the maintainability rule in `agent/strategy/engineering-guardrails.md` that large-file growth is a refactoring trigger and mixed responsibilities should be split before more behavior is added.

## Goal

Split backend persistence into smaller repository modules aligned to coherent responsibilities so plan reads, gym reads, workout writes, and active-workout reconstruction can evolve independently.

## Scope

- separate reference-data reads from workout lifecycle writes
- extract active-workout reconstruction or mapping helpers into focused modules
- keep explicit SQL and SQLx, but reduce the number of unrelated responsibilities per file

## Acceptance Criteria

- persistence code is organized into multiple focused modules rather than one catch-all file
- no single persistence module owns both reference-data reads and the full active-workout mutation lifecycle
- backend persistence tests can be maintained without growing one central repository file further

## References

- `backend/src/persistence.rs`
- `backend/tests/persistence_integration.rs`
- `agent/strategy/engineering-guardrails.md`


## Review Acceptance

- Criteria Met: Persistence is split into focused modules (`training_plans`, `workouts`, `active_workouts`, `suggestions`) and no single module now owns both reference-data reads and the full active-workout mutation lifecycle.
- Evidence: `backend/src/persistence/mod.rs` delegates by responsibility; reference-data reads live in `backend/src/persistence/training_plans.rs` while active-workout create/update/complete/cancel behavior is isolated in `backend/src/persistence/active_workouts.rs`, with workout read/write primitives in `backend/src/persistence/workouts.rs`.
- Runtime/Build Check: Executed `cargo test --test persistence_integration option_read_path_is_gym_specific -- --exact` in `backend/`; observed result `test option_read_path_is_gym_specific ... ok` and `test result: ok. 1 passed; 0 failed`.
- Residual Risk: none identified
