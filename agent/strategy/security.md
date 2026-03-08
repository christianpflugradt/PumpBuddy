# Project Security Architecture

## Purpose

This document defines the project-specific security architecture for this repository.

It complements `agent/strategy/security-baseline.md` by describing the concrete trust boundaries, access paths, and security-sensitive implementation rules for this system.

AI tasks must treat this document as authoritative for project-specific security decisions unless the human stakeholder explicitly changes it.

## Relationship to Security Baseline

`security-baseline.md` defines the general security principles for the AI-agent development framework.

This document defines how those principles are applied in this specific project.

Where both documents are loaded:

- `security-baseline.md` defines the general rule set
- `security.md` defines the concrete project security architecture

## Security Architecture Overview

The project uses a three-layer runtime topology:

- a public renderer
- a private backend
- a private PostgreSQL database

This topology is a core security constraint and must be preserved unless explicitly changed by the human stakeholder.

## Trust Boundary Implementation

### Public Boundary

The renderer is the only component that is publicly reachable from the internet.

Its responsibilities are limited to:

- serving the frontend
- acting as the public entrypoint
- forwarding API traffic to the backend

The renderer must not become a place for business logic, privileged maintenance access, or direct database communication.

### Private Service Boundary

The backend is not directly reachable from the public internet.

The renderer communicates with the backend only through the internal Docker network.

The backend may communicate with the PostgreSQL database through the internal Docker network.

No browser or public client may communicate directly with the backend or the database.

### Privileged Local Boundary

Privileged maintenance actions are not exposed through public APIs.

They are performed through a separate CLI tool running inside the backend container.

This means privileged maintenance is expected to occur through container-local execution, for example through `docker exec`, rather than through public or user-facing interfaces.

## Authentication and Access Model

The initial security model is token-based.

Tokens are stored in the database.

The project distinguishes between at least the following access paths:

- workout API access for normal product usage
- administrative API access for management operations
- privileged local maintenance access through the container-local CLI tool

These access paths must remain clearly separated.

Tasks must not collapse them into a single shared interface, shared token, or shared endpoint model unless explicitly approved.

## Token Model

API tokens are persisted in the database.

The system is expected to support at least:

- one token for workout-oriented usage
- one token for administrative usage

These tokens must remain logically separated by access purpose.

The long-term data model should remain compatible with associating tokens to users, even if the system initially behaves as a single-user system.

Tasks must avoid designs that make future token-to-user mapping unnecessarily difficult.

## Maintenance Access Model

Highly privileged maintenance operations, such as token rotation, must be performed through a separate CLI tool inside the backend container.

Constraints:

- do not expose this maintenance path through the public renderer
- do not expose this maintenance path through normal user-facing APIs
- do not add convenience HTTP endpoints for privileged maintenance unless explicitly approved
- keep maintenance execution local to the container runtime

The privileged maintenance boundary is intentionally narrower than the administrative API boundary.

## Service Exposure Rules

Tasks must preserve the following exposure model:

- renderer: public
- backend: internal only
- PostgreSQL: internal only
- maintenance CLI: local-only inside backend container

Any change that would expose the backend, database, or maintenance interface beyond these boundaries must be treated as security-sensitive and requires explicit approval.

## Secret and Token Handling Rules

Tasks must follow these project-specific rules:

- do not commit secrets or real tokens to the repository
- do not log tokens or sensitive credentials in plain text
- do not expose privileged tokens through public interfaces
- prefer runtime-based secret injection or equivalent secure configuration mechanisms
- avoid creating shortcuts that make privileged tokens accessible through user-facing flows

## Security Invariants

The following security invariants must remain true unless explicitly changed by the human stakeholder:

1. The renderer is the only internet-facing component.
2. The backend is reachable only through the internal Docker network.
3. PostgreSQL is reachable only by the backend through the internal Docker network.
4. Privileged maintenance is performed through a separate CLI tool inside the backend container.
5. Workout, administrative, and privileged maintenance access paths remain separated.
6. Tokens are stored in the database, not embedded in repository files or hardcoded in the application.

## Security Review Guidance

`review-security` should evaluate the implementation against both:

- `agent/strategy/security-baseline.md`
- this project-specific `security.md`

Priority review areas for this project are:

- accidental public exposure of backend or database services
- weakening of the renderer/backend/database trust boundaries
- mixing of workout, administrative, and privileged maintenance access paths
- insecure token handling
- introduction of public maintenance endpoints
- designs that make future token-to-user mapping unnecessarily difficult

Findings should be risk-prioritized and should focus on practical remediation.

## Out of Scope for This Document

This document does not define:

- enterprise compliance requirements
- formal certification controls
- exhaustive penetration testing processes
- advanced multi-user authorization rules

Those may be introduced later if explicitly needed.

## Change Notes

- 2026-03-08: Initial project-specific security architecture created to complement the general security baseline.
