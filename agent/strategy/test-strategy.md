# Test Strategy

## Purpose

This document defines the testing strategy for this project.

It is written primarily for AI agents participating in development and review, but it should also remain understandable for human stakeholders.

Its goals are to:

- define how software quality is verified
- specify which kinds of tests should exist
- guide implementation agents when adding tests
- guide review agents when validating changes
- prevent uncontrolled growth of unnecessary tests

This document describes testing philosophy and rules, not individual test cases.

---

# Authority and Scope

This document is authoritative for testing expectations unless the human stakeholder explicitly changes it.

It applies primarily to:

- implementation tasks
- review tasks
- architecture reviews
- consistency reviews
- quality reviews

This document should not be used to describe:

- product behaviour
- domain logic
- plan definition and refinement
- detailed test case specifications

---

# Change Policy

This document should evolve slowly.

Update it when:

- the testing philosophy of the project changes
- new categories of tests become necessary
- the cost-benefit balance of testing changes

Changes should be accompanied by a short explanation in the Change Notes section.

---

# Usage Guidance for AI Agents

AI agents should treat this document as the authoritative testing policy.

Agents must:

- follow the defined testing expectations
- add tests when the strategy requires them
- avoid unnecessary tests when the strategy discourages them
- highlight violations during reviews

If a task conflicts with the testing strategy, the agent should explicitly mention the conflict.

---

# Testing Goals

The testing strategy aims to:

- verify correctness of non-trivial business logic
- prevent regressions in critical workflows
- protect important integration points, especially backend-to-database behaviour
- keep testing effort proportionate to project size and risk
- ensure the system remains maintainable for AI-assisted development

The project does not optimize for maximum test count.
It optimizes for meaningful confidence.

---

# Test Categories

This project currently uses the following test categories:

- Unit Tests
- Integration Tests
- End-to-End Tests

Optional categories such as Contract Testing, Performance Testing, or Security Testing may be added later if the project evolves in a way that justifies them.

---

# Unit Testing

Purpose:

Verify behaviour of small isolated pieces of logic.

Rules:

- unit tests should accompany non-trivial business logic
- backend unit tests should stay close to Rust defaults unless a concrete need appears
- frontend unit tests should focus on meaningful component or logic behaviour rather than trivial rendering details
- tests should focus on behaviour, not internal implementation details
- avoid excessive mocking unless necessary to keep the test meaningful and bounded
- prefer small, deterministic tests with low setup cost

Boundaries:

- unit tests are the default first testing layer for pure or mostly isolated logic
- unit tests should not try to replace realistic integration testing where persistence or system boundaries matter

---

# Integration Testing

Purpose:

Verify that multiple components interact correctly.

This is especially important for:

- backend interaction with PostgreSQL
- persistence logic
- API behaviour where realistic integration matters

Rules:

- use integration tests when correctness depends on real interactions rather than isolated logic
- prefer realistic integration boundaries over heavily simulated behaviour
- avoid duplicating unit test coverage unnecessarily
- use database-backed integration tests deliberately, not mechanically
- integration tests may use temporary infrastructure such as containerized PostgreSQL instances

Boundaries:

- integration tests are especially important for backend persistence and data access behaviour
- integration tests should remain focused on meaningful cross-component behaviour rather than broad system simulation

---

# End-to-End Testing

Purpose:

Verify behaviour from the perspective of the complete running system.

Rules:

- keep the number of end-to-end tests limited
- focus on critical workflows
- prefer stable and maintainable scenarios over broad UI automation
- use E2E testing to protect key user-facing behaviour rather than to cover every small variation
- avoid brittle tests that create more maintenance burden than confidence

Current intent:

- Playwright may be used for selected end-to-end tests
- E2E testing is expected to remain a targeted layer, not the dominant testing strategy

---

# Test Infrastructure

The current testing infrastructure is expected to include:

- Rust built-in test support for backend unit and integration tests
- Testcontainers for Rust for database-backed integration tests
- Vitest for frontend unit testing
- Playwright for selected end-to-end tests

Infrastructure guidance:

- test environments should be reproducible
- backend-database integration tests should validate behaviour against a real PostgreSQL instance where practical
- temporary infrastructure used during tests should remain disposable and automated
- test setup should not depend on hidden manual steps

---

# When Tests Are Required

Implementation agents must add or update tests when:

- introducing non-trivial business logic
- changing backend persistence behaviour
- adding or changing logic that depends on database interaction
- fixing regressions
- changing behaviour in critical user-visible workflows
- introducing API behaviour where a missing test would materially increase regression risk

The goal is meaningful coverage, not mechanical coverage.

---

# When Tests May Be Omitted

Tests may be omitted when:

- changes are purely structural and do not alter behaviour
- documentation-only changes are made
- changes are limited to formatting or non-functional cleanup
- configuration-only changes do not affect executable logic
- a task is so narrow and low-risk that additional tests would not meaningfully improve confidence

When tests are omitted in cases that are not obviously trivial, the implementation or review output should make that reasoning explicit.

---

# Test Review Expectations

Review agents should check:

- whether tests exist where the strategy requires them
- whether tests reflect expected behaviour rather than implementation detail
- whether integration boundaries are tested where they matter
- whether tests are unnecessarily complex or brittle
- whether the selected tests provide meaningful confidence for the change

Review agents should avoid requesting tests that do not materially improve confidence.

They should also avoid accepting missing tests where the testing strategy clearly expects them.

---

# Change Notes

- 2026-03-08: Initial project-specific test strategy defined from the test strategy template.
