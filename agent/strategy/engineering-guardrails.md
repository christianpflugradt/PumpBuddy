# Engineering Guardrails

## Purpose

This document defines the engineering guardrails for this project.

It is written primarily for AI agents participating in development, but it should also remain readable for human stakeholders.

Its purpose is to:

- define implementation rules that must be preserved across tasks
- reduce unnecessary architectural and implementation drift
- make recurring engineering decisions deterministic
- provide implementation and review agents with stable constraints

This document defines engineering rules, not product requirements.

---

# Authority and Scope

This document is authoritative for recurring engineering decisions unless the human stakeholder explicitly changes it.

It applies primarily to:

- implementation tasks
- architecture-sensitive reviews
- consistency reviews
- technology reviews
- quality reviews

It may also be relevant during milestone refinement when execution items depend on engineering constraints.

This document should not be used to describe:

- product capabilities
- use cases
- milestone goals
- domain behaviour
- API semantics except where engineering rules constrain them

---

# Change Policy

This document should evolve slowly.

Update it when:

- a recurring engineering rule changes
- a new implementation invariant must be preserved
- an earlier rule proved too weak, too broad, or incorrect

Changes should be accompanied by a short rationale in the change notes.

---

# Usage Guidance for AI Agents

AI agents should treat this document as a constraint document.

Agents must:

- follow these guardrails by default
- avoid silent deviations
- raise explicit findings when an item conflicts with a guardrail
- prefer conservative implementation choices when the document leaves room for interpretation

If a task requires a justified exception, the exception should be explicit and documented.

---

# Repository and Structure Rules

Purpose:

Define structural conventions that should remain stable across the repository.

Rules:

- keep the repository structure clear and predictable
- keep the AI-agent framework files under `agent/`
- keep automation scripts under `scripts/`
- keep temporary agent artifacts under `agent/tmp/`
- keep generated artifacts separate from handwritten source code where practical
- do not scatter framework documents across unrelated locations
- do not use ad hoc directories when a stable project location already exists
- keep execution items under `agent/execution/` and preserve filename-based item states
- do not encode execution item state inside file content when the filename already defines it

Intentionally flexible:

- internal module layout within frontend and backend source trees
- exact naming of source subdirectories unless constrained elsewhere

---

# Dependency Rules

Purpose:

Define how dependencies should be selected and introduced.

Rules:

- prefer mature, well-supported, and actively maintained dependencies
- avoid introducing niche, weakly maintained, or unnecessary dependencies
- minimize dependency count where practical
- prefer dependencies that fit the existing stack and operational model
- keep dependency choices compatible with Renovate-based update workflows
- do not introduce an ORM
- for database access, prefer explicit SQL through SQLx
- do not introduce large frontend frameworks such as Angular
- if a small helper library is introduced, it must not undermine the intended lightweight architecture

Intentionally flexible:

- small helper libraries that clearly improve implementation quality without violating the tech stack
- routine version selection, as long as it remains compatible with project tooling and CI

---

# Configuration Rules

Purpose:

Define how application configuration should be handled.

Rules:

- prefer environment-based configuration or equivalent runtime configuration mechanisms
- keep configuration separate from code
- do not hardcode secrets, tokens, or environment-specific values in source files
- keep local development, CI, and container runtime configuration paths understandable and explicit
- prefer typed or validated configuration loading where appropriate
- configuration required for build, runtime, or tests should be discoverable and reproducible

Intentionally flexible:

- exact configuration library choices, as long as they fit the language ecosystem and the tech stack
- non-sensitive default values used only for local development or test scaffolding

---

# Error Handling Rules

Purpose:

Define expectations for error handling and failure behaviour.

Rules:

- prefer explicit and predictable error handling
- do not silently swallow errors
- propagate failures in a way that preserves useful context
- return actionable errors at API boundaries
- distinguish between validation failures, operational failures, and internal errors where practical
- do not expose sensitive internal details through public-facing error messages
- prefer bounded failure over hidden partial success when correctness matters

Intentionally flexible:

- exact internal error type design
- exact message wording for non-user-facing failures

---

# Logging Rules

Purpose:

Define how logging should be approached.

Rules:

- produce logs that are useful for debugging and operations
- do not log secrets, tokens, or sensitive credentials
- avoid noisy logs that obscure useful information
- prefer structured or consistently formatted logs where practical
- ensure failures relevant to debugging are observable in logs
- do not use logging as a substitute for proper error handling

Intentionally flexible:

- exact logging library choices
- exact log structure, provided it remains consistent and safe

---

# Code Generation Rules

Purpose:

Define expectations around generated code.

Rules:

- OpenAPI YAML is the canonical contract
- generated code is not committed by default
- generated artifacts must be recreated during build or CI
- manually edited generated files are not allowed
- generated code must remain reproducible from its authoritative source
- do not treat generated code as the primary design authority
- if generated code must be committed due to tooling limitations, the exception must be explicitly justified

Intentionally flexible:

- exact generator tooling
- exact generated output paths, as long as they remain predictable and separated from handwritten code where practical

---

# Persistence and Database Access Rules

Purpose:

Define how persistence should be approached.

Rules:

- PostgreSQL is the primary persistent data store
- only backend services may communicate directly with the database
- direct browser-to-database access is forbidden
- use explicit SQL through SQLx
- keep business logic separate from raw persistence concerns
- design persistence with future user association in mind, even if the system initially behaves as single-user
- avoid persistence shortcuts that would make future token-to-user mapping or ownership modelling unnecessarily difficult

Intentionally flexible:

- exact query organization
- exact repository or data-access-layer structure, provided responsibilities remain clear

---

# API Implementation Rules

Purpose:

Define engineering constraints for implementing APIs.

Rules:

- treat the OpenAPI YAML as the canonical API contract
- follow contract-first development
- frontend and backend implementations must stay aligned with the contract
- validate inputs at the backend boundary
- keep business rules authoritative in the backend
- avoid casually introducing new APIs beyond the intended surfaces
- preserve the separation between workout-oriented APIs, administrative APIs, and privileged local maintenance paths

Intentionally flexible:

- exact endpoint handler organization
- exact DTO or model layering, as long as the canonical contract remains authoritative

---

# Runtime and Container Rules

Purpose:

Define engineering constraints related to runtime packaging and containerization.

Rules:

- the renderer is the only public entrypoint
- the renderer serves built frontend assets and forwards API traffic to the backend
- the backend is internal-only
- PostgreSQL is internal-only
- privileged maintenance must remain local to the backend container runtime
- do not expose convenience maintenance endpoints publicly
- preserve the topology of renderer public, backend internal, database internal unless explicitly changed by the human stakeholder
- keep runtime packaging compatible with Docker and Docker Compose

Intentionally flexible:

- exact container image structure
- exact Compose service naming
- exact local orchestration details, as long as the trust boundaries remain intact

---

# Temporary Files and Generated Artifacts Rules

Purpose:

Define handling of temporary files and generated outputs.

Rules:

- temporary agent files may exist under `agent/tmp/`
- temporary files must not be committed by default
- `.gitkeep` may be committed to preserve otherwise empty directories
- generated or temporary artifacts should be ignored by Git unless explicitly intended for version control
- scripts may rely on predictable temporary file paths, but these files must remain disposable
- do not treat temporary files as authoritative project state

Intentionally flexible:

- exact naming of temporary files used by scripts
- additional ignored temp files, as long as they do not obscure reproducibility

---

# Commit and Versioning Rules

Purpose:

Define repository-level change recording rules.

Rules:

- use Conventional Commits
- do not use scopes in commit messages
- prefer a single-line commit message when the change is small and self-contained
- use a multi-line commit message when the change spans multiple files or benefits from additional explanation
- keep commit messages specific and descriptive
- semantic-release is part of the intended release tooling and must not be undermined by inconsistent commit conventions
- when scripts finalize task work, commit messages may be provided through dedicated files in `agent/tmp/`

Intentionally flexible:

- the exact wording of descriptive commit bodies
- whether a specific small change uses a one-line or multi-line message, provided the result is clear and consistent

---

# Section Authoring Pattern

When adding or revising project-specific guardrails, each section should ideally answer:

1. What is the purpose of this rule area?
2. What must agents preserve?
3. What is explicitly allowed?
4. What is explicitly disallowed?
5. What is intentionally left flexible?

This pattern helps keep the document precise without making it unnecessarily long.

---

# Change Notes

- 2026-03-08: Initial project-specific engineering guardrails defined from the engineering guardrails template.
