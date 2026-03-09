# tech-stack.md

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

- task that implements changes (for example `implement-item`): before proposing or applying architecture-affecting changes
- task that refines scope (for example `refine-plan`): before changing technical direction or introducing major dependencies
- tasks that review adherence (for example `review-item`, `review-technology`, `review-architecture`): when checking stack adherence and architectural consistency

This file may be skipped for:

- purely editorial changes
- non-technical documentation updates
- minor refactors with no technology or boundary impact

When this file conflicts with an execution item, the human stakeholder decision has highest priority.

## Architectural Intent

The stack is intentionally designed to support:

- [maintainability target]
- [operational complexity target]
- [delivery style, for example incremental plans]
- [security or compliance posture]
- [scalability expectations]
- [AI-assisted development efficiency]

High-level system shape:

- [component or subsystem A]
- [component or subsystem B]
- [component or subsystem C]

Trust and exposure boundaries:

- [what is public]
- [what is private]
- [critical isolation constraints]

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

- [language 1]
- [language 2]

### Core Runtime and Frameworks

- [runtime/framework 1]
- [runtime/framework 2]

### Data and Persistence

- [primary datastore]
- [secondary datastore or cache, if any]

### Interface Contract

- [API or interface contract format, for example OpenAPI, GraphQL schema, Protobuf, event schema]
- [canonical contract location or ownership rule]

### Delivery and Automation Tooling

- [CI platform]
- [release tooling]
- [dependency update tooling]
- [container/build tooling if relevant]

## Optional Architecture Sections

Use only the sections relevant to this project. Omit what does not apply.

### User Interface Layer (optional)

Required technologies:

- [technology]

Intent:

- [intended behavior model]

Constraints:

- [must]
- [must not]

### Service/Application Layer (optional)

Required technologies:

- [technology]

Intent:

- [business logic and orchestration expectations]

Constraints:

- [must]
- [must not]

### Data Layer (optional)

Required technologies:

- [technology]

Intent:

- [persistence and consistency expectations]

Constraints:

- [must]
- [must not]

### Messaging and Async Processing (optional)

Required technologies:

- [queue, broker, or stream platform]

Intent:

- [async workflow expectations]

Constraints:

- [delivery guarantees, retry, idempotency]

### Compute and Batch Workloads (optional)

Required technologies:

- [scheduler, worker runtime, orchestration]

Intent:

- [batch/cron/workflow expectations]

Constraints:

- [resource and isolation rules]

### Platform and Infrastructure (optional)

Required technologies:

- [cloud/on-prem/runtime platform]

Intent:

- [deployment topology]

Constraints:

- [network, secrets, access boundaries]

## Security and Access Model

Initial direction:

- [token/session/key/certificate model]

Expected separation:

- [end-user access path]
- [admin or operator path]
- [high-privilege maintenance path]

Constraint:

- do not collapse distinct trust boundaries into a single generic interface without explicit approval

## Testing and Quality Strategy

### Unit and Integration Testing

- [primary unit test tools]
- [integration test approach]

### System or End-to-End Testing

- [tooling and scope]

Constraints:

- prefer a small number of high-value tests over broad, fragile automation
- validate behavior at real integration boundaries where practical

## Code Generation Policy (optional)

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

- [rejected approach 1]
- [rejected approach 2]
- [rejected approach 3]

## Change Notes

- YYYY-MM-DD: Initial template adapted for [project name].
