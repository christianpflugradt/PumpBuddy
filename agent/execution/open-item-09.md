# Add Backend Rust Dependency Cache In CI

## Goal

Improve backend CI runtime by adding standard Rust dependency caching to the backend quality job.

## Scope

- integrate a maintained Rust cache action into backend CI quality workflow
- keep backend quality checks and coverage generation behavior unchanged
- capture baseline versus post-change runtime evidence for the backend job

## Acceptance Criteria

- `.github/workflows/ci-quality.yml` backend job includes `rust-cache` setup compatible with the current Rust toolchain flow
- backend quality commands remain unchanged in intent and continue to execute in CI
- measured evidence from at least one before/after CI run (or equivalent reproducible benchmark) shows backend job runtime improvement

## References

- `agent/strategy/plan.md`
- `.github/workflows/ci-quality.yml`
- `agent/strategy/test-strategy.md`
- `agent/strategy/tech-stack.md`

## Out of Scope

- introducing `cargo-chef` or multi-stage caching strategies beyond standard rust-cache
