# Security Baseline

## Purpose

This document defines the security baseline for the project.

It describes the intended trust model, security boundaries, and minimal security expectations that implementation and review tasks must preserve.

AI tasks must treat this document as authoritative for security-related decisions unless the human stakeholder explicitly changes it.

---

# Scope

This document defines practical application security for the system.

It is intentionally lightweight and does not impose enterprise-level compliance frameworks unless explicitly requested.

The goal is to provide clear guardrails that help prevent obvious architectural security mistakes.

---

# Security Intent

The security model prioritizes:

- explicit trust boundaries
- minimal public attack surface
- separation of access paths
- controlled credential handling
- secure defaults in architecture and operations

Security design should aim for simple, understandable boundaries rather than complex defensive layers.

---

# Trust Boundaries

The system must maintain explicit boundaries between the following zones:

### Public Boundary

Interfaces reachable from the public internet.

Typical examples:

- user-facing web interfaces
- public API endpoints

Constraints:

- assume hostile traffic
- avoid exposing internal services through convenience proxies
- do not introduce additional public endpoints without explicit approval

---

### Private Service Boundary

Internal service-to-service communication.

Typical examples:

- backend-to-database communication
- internal service APIs
- container-to-container communication within trusted infrastructure

Constraints:

- must not be exposed to the public internet
- must remain restricted to internal infrastructure

---

### Privileged Local Boundary

Local maintenance operations requiring elevated privileges.

Typical examples:

- container-local maintenance scripts
- token rotation commands
- direct administrative operations

Constraints:

- must remain local-only
- must never be exposed through public APIs
- must not be accessible through user-facing interfaces

---

# Authentication and Access Separation

The system should separate access paths for different operational purposes.

Expected model:

1. user-facing access path for normal product usage
2. administrative access path for infrequent management operations
3. privileged local-only path for high-trust maintenance tasks

Constraints:

- avoid collapsing all access paths into a single interface
- avoid implicit privilege escalation
- prefer explicit separation over hidden logic

---

# Secret and Token Handling

Tasks must follow these rules:

- never commit secrets or long-lived tokens to the repository
- avoid generating realistic-looking example tokens
- prefer environment-based secret injection or equivalent runtime mechanisms
- do not log sensitive values in plain text
- avoid exposing privileged credentials through public interfaces

---

# Exposure and Surface Control

Security-sensitive components must follow these constraints:

- keep internal services non-public by default
- avoid exposing internal maintenance endpoints
- minimize externally reachable components
- avoid proxying internal services through public interfaces unless explicitly required

---

# Security Review Expectations

The `review-security` task focuses on identifying high-impact security risks.

Priority areas:

- violations of trust boundaries
- credential or token exposure risks
- unsafe authentication or authorization patterns
- accidental exposure of internal services
- obvious misconfigurations that expand the attack surface

Findings should:

- be prioritized by risk
- include practical remediation guidance
- avoid theoretical or speculative vulnerabilities

---

# Out of Scope by Default

Unless explicitly requested, the following are not required:

- formal compliance checklists
- regulatory certification processes
- full penetration testing frameworks

The goal is practical security for a small engineering project.

---

# Change Notes

2026-03-08  
Initial security baseline created for the AI-agent development framework.
