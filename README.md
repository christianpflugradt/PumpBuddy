# PumpBuddy

[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg)](LICENSE)
[![CI Quality](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci-quality.yml/badge.svg)](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci-quality.yml)
[![Agent Framework Quality](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/agent-framework-quality.yml/badge.svg)](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/agent-framework-quality.yml)
[![Backend Coverage](https://img.shields.io/endpoint?url=https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json&cacheSeconds=300)](https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json)
[![Renderer Coverage](https://img.shields.io/endpoint?url=https://christianpflugradt.github.io/PumpBuddy/badges/renderer-coverage.json&cacheSeconds=300)](https://christianpflugradt.github.io/PumpBuddy/badges/renderer-coverage.json)

PumpBuddy is a personal training companion for structured gym workouts.
It focuses on clear plans, low-friction execution, and durable training history.

## Product Idea

PumpBuddy helps one user:

- define and execute training plans
- record workout progress with minimal manual input
- keep historical training data reliable and analyzable

PumpBuddy is intentionally a personal tool, not a social platform.

## Architecture Overview

PumpBuddy uses a simple three-part service architecture:

- Renderer (web UI)
- Backend service (Rust API)
- PostgreSQL database

Only the renderer is publicly exposed; backend and database stay internal to the container network.

## Technology Stack

- Frontend: TypeScript + Web Components
- Backend: Rust
- Database: PostgreSQL
- Deployment/runtime: Docker Compose

## Development Quick Start

Run software quality checks:

```bash
make check
```

Install managed pre-push hook:

```bash
make install-git-hooks
```

The hook runs quality checks before every `git push`.

## AI-Assisted Workflow (Short)

Task-driven execution starts with:

```text
Task: <task-name|alias|number>
```

or

```text
T: <task-name|alias|number>
```

Authoritative task startup behavior: [`AGENTS.md`](AGENTS.md)

Task catalog and setup docs:

- [`agent/meta/agent-tasks.md`](agent/meta/agent-tasks.md)
- [`agent/meta/agent-setup.md`](agent/meta/agent-setup.md)

## Validation and CI

There are two intentionally separate CI signals:

- **CI Quality**: backend/renderer software quality
- **Agent Framework Quality**: agent framework contracts and script hygiene

Run framework validation locally:

```bash
agent/scripts/check/validate-docs.sh
```

Validation details are documented in [`validation/README.md`](validation/README.md).

## Commit Policy

Conventional commit policy is defined in:

- [`agent/strategy/commit-policy.yaml`](agent/strategy/commit-policy.yaml)

## OpenAPI Model Generation

Canonical API contract:

- `agent/design/api-contract.yaml`

Generate models:

```bash
make generate-openapi
```

Targeted commands:

- `make generate-openapi-backend`
- `make generate-openapi-renderer`
- `npm run generate:openapi` (from `renderer/`)

## Runtime and Operations

Operational/local runtime procedures were moved to:

- [`docs/operations.md`](docs/operations.md)

## Release

Releases are triggered via GitHub Actions `Release` workflow (`workflow_dispatch`) and semantic-release.

Release tooling is repository-managed and pinned via `package-lock.json`:

- install exact release dependencies: `npm ci`
- verify release resolution locally (dry-run): `npx semantic-release --dry-run`
- CI workflow uses `npm ci` and then `npm run release`

## Project Status

PumpBuddy is in early iterative development with small, task-driven plan cycles.

## License

PumpBuddy is released under the **PolyForm Noncommercial License 1.0.0**.
Commercial use is not permitted without explicit permission from the licensor.
