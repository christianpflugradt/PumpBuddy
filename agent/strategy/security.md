# security.md

## Purpose

This document defines the project security baseline for AI tasks.

It specifies the intended trust model, security boundaries, and minimum security expectations that tasks must preserve.

AI tasks must treat this document as authoritative for security-related decisions unless the human stakeholder explicitly changes it.

## Scope

This file focuses on practical product security for this project.

It is not a full compliance framework and does not require enterprise-level controls unless explicitly requested.

## Security Intent

The project security model is designed to support:

- clear trust boundaries
- minimal public attack surface
- explicit separation of access paths
- safe handling of credentials and tokens
- secure defaults in architecture and operations

## Trust Boundaries

Define and keep these boundaries explicit:

- public boundary: user-facing interfaces that are internet reachable
- private service boundary: internal service-to-service communication
- privileged local boundary: local-only maintenance operations

Tasks must not weaken these boundaries without explicit approval.

## Authentication and Access Separation

Expected model:

- user-facing access path for normal product usage
- separate administrative access path for lower-frequency management operations
- separate local-only path for highly privileged maintenance actions

Constraints:

- do not collapse all access patterns into one generic interface
- avoid accidental privilege escalation through shared tokens or shared endpoints
- prefer explicit separation over implicit behavior

## Secret and Token Handling

Tasks must:

- avoid committing secrets or long-lived tokens into the repository
- prefer environment-based secret injection or equivalent secure runtime mechanisms
- avoid logging sensitive values in plain text
- avoid exposing privileged credentials to public interfaces

## Exposure and Surface Control

Tasks must:

- keep non-public services non-public by default
- avoid exposing internal maintenance endpoints publicly
- minimize externally reachable components and interfaces

## Security Review Expectations

`review-security` should prioritize:

- boundary violations
- credential/token risks
- high-impact auth/access flaws
- obvious high-risk misconfigurations

Findings should be risk-prioritized and include practical remediation guidance.

## Out of Scope by Default

Unless explicitly requested, this file does not require:

- full compliance audit checklists
- formal certification controls
- exhaustive penetration-testing process definitions

## Change Notes

- 2026-03-08: Initial security strategy baseline created for task-driven security reviews.
