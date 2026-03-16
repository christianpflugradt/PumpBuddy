# Plan: Relocate Backend Route Tests to Feature Modules

Goal: move route-level tests out of `backend/src/api/handlers.rs` into feature-focused test modules so tests follow handler ownership boundaries while preserving behavior and test coverage.

Implementation steps:

- **Inventory tests**: open `backend/src/api/handlers.rs` and copy all tests in the `#[cfg(test)] mod tests` block to a temp area. Identify which tests assert behaviour for specific features (auth, health, workouts, training-plans) vs composition-only checks (router wiring, missing endpoints).

- **Create feature test files**: add `backend/src/api/tests_auth.rs`, `backend/src/api/tests_health.rs`, and `backend/src/api/tests_router.rs` (or other feature-named files matching handler ownership). Move each test function into the appropriate file.

- **Extract shared test helpers**: move `lazy_test_repository()` and any shared imports into a small `backend/src/api/test_helpers.rs` module. Export helpers with `pub(crate)` so feature test files can `use crate::api::test_helpers::*;`.

- **Adjust imports and visibility**: update moved tests to import `crate::api::app_router`, `crate::api::AppState`, and `crate::persistence::DomainRepository` as needed. If `test_helpers` is used, add `mod test_helpers;` in `backend/src/api/lib.rs` or `backend/src/api/mod.rs` behind `#[cfg(test)]` so tests can reference it.

- **Preserve composition checks**: keep only minimal composition-oriented tests in `handlers.rs` (for example the `removed_bootstrap_path` test or a simple router-not-found assertion) if they verify router composition semantics rather than endpoint behavior.

- **Run and verify**: execute `cargo test --manifest-path backend/Cargo.toml` and ensure all tests pass and behaviour assertions remain equivalent. If any tests rely on private functions or crate-local visibility, adjust by moving them into `#[cfg(test)]` modules in the owning feature module or make small visibility changes strictly for tests.

Edge-cases / Notes:

- Avoid changing test intent or broadening scope: relocate only — do not change assertions or add new behaviour.
- If tests rely on `async` runtime setup or other heavy fixtures, keep those fixtures in `test_helpers` so the relocation is minimal.
- If moving tests causes visibility issues, prefer adding `#[cfg(test)] pub(crate) mod test_helpers` or placing moved tests in the same module tree as code they assert against to retain access.

Verification steps (executable):

- Run: `cargo test --manifest-path backend/Cargo.toml` and confirm success.

Acceptance criteria mapping:

- Route-level tests are no longer concentrated in the router composition module: achieved by moving tests into feature files.
- Feature modules own their relevant endpoint behaviour tests: tests placed next to owning handler modules.
- Backend API tests remain passing with equivalent behaviour coverage: verified by running cargo test.
