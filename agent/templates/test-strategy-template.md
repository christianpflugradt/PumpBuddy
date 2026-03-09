# Test Strategy Template

## Purpose

This document defines the **testing strategy for a project**.

It is written primarily for **AI agents participating in development and review**, but it should also remain understandable for human stakeholders.

Its goals are to:

- define how software quality is verified
- specify which kinds of tests should exist
- guide implementation agents when adding tests
- guide review agents when validating changes
- prevent uncontrolled growth of unnecessary tests

This document describes **testing philosophy and rules**, not individual test cases.

---

# Authority and Scope

This document is authoritative for testing expectations unless the human stakeholder explicitly changes it.

It applies primarily to:

- implementation tasks
- review tasks
- architecture reviews
- consistency reviews

This document should **not** be used to describe:

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
- the cost–benefit balance of testing changes

Changes should be accompanied by a short explanation in the **Change Notes** section.

---

# Usage Guidance for AI Agents

AI agents should treat this document as **the authoritative testing policy**.

Agents must:

- follow the defined testing expectations
- add tests when the strategy requires them
- avoid unnecessary tests when the strategy discourages them
- highlight violations during reviews

If a task conflicts with the testing strategy, the agent should explicitly mention the conflict.

---

# Template Usage Guidance

When using this template for a project:

Rules:

- keep only sections relevant to the project
- remove unused sections entirely
- keep descriptions concise and operational
- avoid describing the full system architecture here

The goal is to define **how testing should be performed**, not to describe the system itself.

---

# Testing Goals

Purpose:

Describe **what the testing strategy tries to achieve**.

Typical goals may include:

- verifying correctness of core logic
- preventing regressions
- protecting critical integration points
- ensuring predictable system behaviour

This section should describe **intent**, not individual test rules.

---

# Test Categories

Define which kinds of tests exist in the project.

Common categories include:

- Unit Tests
- Integration Tests
- End‑to‑End Tests
- Contract Tests
- Performance Tests

Projects may choose only a subset of these.

Each selected category should be defined in its own section.

---

# Unit Testing

Purpose:

Verify behaviour of **small isolated pieces of logic**.

Typical characteristics:

- fast execution
- minimal external dependencies
- deterministic results

Possible rules:

- unit tests should accompany non-trivial business logic
- tests should focus on behaviour, not internal implementation
- avoid excessive mocking unless necessary

Omit this section only if the project intentionally avoids unit tests.

---

# Integration Testing

Purpose:

Verify that **multiple components interact correctly**.

Typical examples:

- application interacting with a database
- service interacting with external dependencies
- persistence logic correctness

Possible rules:

- integration tests may use temporary infrastructure
- tests should focus on realistic interactions
- avoid duplicating unit test coverage

Use this section when the project contains interacting subsystems.

---

# End-to-End Testing

Purpose:

Verify behaviour from the perspective of the **complete running system**.

Typical examples:

- user workflows through the application
- browser automation
- API workflows executed through the full stack

Possible rules:

- keep the number of E2E tests limited
- focus on critical workflows
- ensure tests remain stable and maintainable

Use this section when the project includes user-facing functionality.

---

# Test Infrastructure

Purpose:

Describe tools or infrastructure used for testing.

Examples:

- containerized test environments
- database containers
- browser automation tools
- test orchestration frameworks

This section may also describe:

- how test environments are started
- how test data is managed
- how tests interact with external services

---

# When Tests Are Required

Purpose:

Define when implementation agents **must add tests**.

Examples:

Tests may be required when:

- implementing non-trivial domain logic
- introducing new integration behaviour
- modifying persistence logic
- fixing regressions

The rules should focus on **meaningful coverage**, not mechanical coverage.

---

# When Tests May Be Omitted

Purpose:

Clarify situations where tests are **not required**.

Examples:

Tests may be omitted when:

- changes are purely structural
- documentation-only changes are made
- configuration adjustments occur without logic changes

This prevents unnecessary test creation.

---

# Test Review Expectations

Purpose:

Guide review agents when evaluating tests.

Reviewers should check:

- whether tests exist where required
- whether tests reflect expected behaviour
- whether tests are unnecessarily complex
- whether tests provide meaningful coverage

Reviewers should avoid requesting tests that do not improve system confidence.

---

# Optional Sections

Add the following sections only when relevant.

## Contract Testing

Used when APIs or external interfaces must remain stable.

May include:

- schema validation
- API compatibility testing
- consumer contract verification

---

## Performance Testing

Used when performance characteristics are important.

May include:

- load testing expectations
- performance regression detection
- latency thresholds

---

## Security Testing

Used when automated security checks are part of the project.

May include:

- dependency scanning
- vulnerability detection
- static security analysis

---

# Section Authoring Pattern

Each testing section should answer:

1. What type of behaviour does this testing category verify?
2. When should these tests be written?
3. What are the boundaries of the tests?
4. What should be avoided?

This helps keep the document clear and actionable.

---

# Example Skeleton

The following structure may be used for a project-specific testing strategy.

```md
# Test Strategy

## Purpose

[Describe the testing goals.]

## Authority and Scope

[Explain when the strategy applies.]

## Testing Goals

[...]

## Test Categories

- Unit Tests
- Integration Tests

## Unit Testing

Purpose:
[...]
Rules:
- [...]
- [...]

## Integration Testing

Purpose:
[...]
Rules:
- [...]
- [...]

## End-to-End Testing

Purpose:
[...]
Rules:
- [...]
- [...]

## Test Infrastructure

[Describe tools and environment.]

## When Tests Are Required

- [...]
- [...]

## When Tests May Be Omitted

- [...]
- [...]

## Test Review Expectations

- [...]
- [...]

## Change Notes

- YYYY-MM-DD: Initial project-specific test strategy defined.
```

---

# Change Notes

- 2026-03-08: Initial test strategy template created.
