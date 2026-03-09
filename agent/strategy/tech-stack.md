# Tech Stack Definition

## Document Status

- status: active
- scope: project-specific
- owner: human stakeholder
- applies-to: implementation, refinement, and review tasks

Change policy:
- update this file when a major technology or constraint changes
- record a short change note with date at the end of this file

## Purpose

This document defines the project-specific technology baseline for AI agents working on this repository.

It constrains major implementation choices and reduces unnecessary variance while keeping minor tooling decisions flexible.

AI agents must treat this document as authoritative for major technology choices unless the human stakeholder explicitly changes it.

## Usage Rules for AI Agents

AI agents using this document must follow these rules:

- use the technologies defined here as default implementation choices
- do not replace major technologies without explicit human approval
- do not introduce alternative frameworks when the defined stack already covers the need
- keep implementation choices aligned with architectural intent
- treat unspecified low-level libraries as flexible, but prefer conservative and well-supported options

This document defines major stack decisions, not every implementation detail.

## Agent Consumption Contract

This file must be loaded by AI agents in the following situations:

- `implement-item`: before proposing or applying architecture-affecting changes
- `refine-plan`: before changing technical direction or introducing major dependencies
- `review-item`, `review-technology`, and `review-architecture`: when checking stack adherence and architectural consistency

This file may be skipped for:

- purely editorial changes
- non-technical documentation updates
- minor refactors with no technology or boundary impact

When this file conflicts with an execution item, the human stakeholder decision has highest priority.

## Architectural Intent

The stack is intentionally designed to support:

- long-term maintainability
- low operational complexity
- incremental delivery through small plans
- secure service boundaries
- modest future growth without premature overengineering
- AI-assisted development efficiency

High-level system shape:

- a thin public renderer layer
- a private backend service
- a private PostgreSQL database

Trust and exposure boundaries:

- only the renderer is public
- backend and database remain private on the internal container network
- browser traffic reaches the backend only through the renderer
- direct browser-to-database access is forbidden

## Version and Compatibility Policy

This document defines technology families and architectural boundaries, not pinned patch versions.

AI agents must:

- prefer current stable releases compatible with existing repository configuration
- avoid introducing prerelease versions unless explicitly requested
- align version decisions with lockfiles, toolchain files, and CI configuration
- avoid major version upgrades unless required by the task or explicitly approved

When exact minimum versions are required, define them in project tooling files rather than duplicating them here.

## Technology Baseline

### Core Languages

- TypeScript
- Rust

### Core Runtime and Frameworks

- Web Components
- SCSS
- Vite
- Caddy
- Axum
- Tokio
- Serde
- SQLx

### Data and Persistence

- PostgreSQL

### Interface Contract

- OpenAPI in YAML format
- the OpenAPI YAML is the canonical contract and follows a contract-first model

### Delivery and Automation Tooling

- GitHub Actions
- Conventional Commits
- semantic-release
- Renovate
- Docker
- Docker Compose

## Optional Architecture Sections

Use only the sections relevant to this project. Omit what does not apply.

### User Interface Layer

Required technologies:

- TypeScript
- Web Components
- SCSS
- Vite

Intent:

- provide a lightweight browser interface without heavy framework dependencies
- keep the page loaded while the workout progresses
- update visible UI content dynamically without full page reloads
- send workout progress incrementally to the backend
- allow backend responses to determine the next relevant workout state or next relevant data
- keep frontend state aligned with backend-persisted progress

Constraints:

- avoid introducing large frontend frameworks unless explicitly approved
- prefer plain Web Components
- prefer simple components and minimal client-side state complexity
- treat the frontend as a consumer of the canonical API contract
- avoid full-page reloads for normal interaction flows

### Service/Application Layer

Required technologies:

- Rust
- Axum
- Tokio
- Serde
- SQLx

Intent:

- implement business logic
- handle validation
- implement the APIs
- persist workout and administrative state
- remain the authority for persisted progress and system rules

Constraints:

- persistence must use explicit SQL
- ORM frameworks are intentionally excluded
- business logic must remain server-side
- backend data access must use SQLx
- a local-only maintenance path should exist for highly privileged actions such as credential or token rotation
- prefer backend-internal commands, container-local scripts, or localhost-only mechanisms for privileged maintenance actions
- do not introduce public maintenance endpoints unnecessarily

### Data Layer

Required technologies:

- PostgreSQL

Intent:

- provide the primary persistent data store
- support current single-user behaviour while keeping future user ownership possible

Constraints:

- only backend services communicate with the database
- no direct browser access
- schema should allow potential multi-user support
- even in the initial single-user phase, the data model should keep future ownership and user association in mind where reasonable

### Platform and Infrastructure

Required technologies:

- Caddy
- Docker
- Docker Compose
- GitHub Actions

Intent:

- expose only the renderer publicly
- keep backend and database private on the container network
- serve built frontend assets through the renderer
- forward browser API traffic from the renderer to the backend
- support automated quality checks, builds, release workflows, and container image builds

Constraints:

- the renderer must remain operationally simple
- the renderer must not contain meaningful business logic
- backend services must not be publicly exposed
- preserve the topology of renderer public, backend internal, database internal unless explicitly instructed otherwise

## Security and Access Model

Initial direction:

- token-based authentication

Expected separation:

- workout API access for the training flow
- administrative API access for lower-frequency management operations
- local-only operational access for privileged maintenance actions

Constraint:

- do not collapse distinct trust boundaries into a single generic interface without explicit approval
- avoid premature permission model complexity
- prefer separate interfaces or clearly separated API surfaces over complex permission layering too early

## Testing and Quality Strategy

### Unit and Integration Testing

- Rust built-in testing framework for unit and integration tests
- Testcontainers for Rust for database-backed integration tests
- Vitest for unit-level frontend testing

### System or End-to-End Testing

- Playwright for selected end-to-end tests

Constraints:

- prefer a small number of high-value tests over broad, fragile automation
- keep backend unit testing close to Rust defaults unless a concrete need appears
- use database-backed integration tests sparingly but deliberately
- validate backend-database behaviour against a real PostgreSQL instance where practical
- focus end-to-end tests on critical workflows

## Code Generation Policy

Default policy:

- generated code is not committed by default
- generated artifacts are recreated during build and CI
- manually edited generated files are not allowed

Allowed exception:

- generated code may be committed only when explicitly required for reproducibility or tooling limitations
- exceptions require a short rationale in the related change

## Decision Boundaries

This document is intentionally specific about:

- core languages and runtimes
- major frameworks and runtime services
- interface contract authority
- persistence direction
- quality and deployment direction

It is intentionally less specific about:

- helper libraries
- internal module naming
- folder layout details
- minor implementation tooling

Those choices may be made by AI agents as long as they remain aligned with this document and broader project guardrails.

## Technology Choices Explicitly Rejected

AI agents must treat the following as intentionally excluded unless explicitly approved later:

- heavy frontend frameworks such as Angular
- ORM-driven backend persistence
- full-page reloads as the normal workout progression mechanism
- committed generated API code as the default approach

## Change Notes

- 2026-03-08: Restructured the project-specific tech stack to conform to the template while preserving project-specific constraints and implementation guidance.
