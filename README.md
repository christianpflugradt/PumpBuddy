# PumpBuddy

[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/christianpflugradt/PumpBuddy?sort=semver)](https://github.com/christianpflugradt/PumpBuddy/releases/latest)
[![CI Quality](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci-quality.yaml/badge.svg)](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci-quality.yaml)
[![Agent Framework Quality](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/agent-framework-quality.yaml/badge.svg)](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/agent-framework-quality.yaml)
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

Run targeted quality checks:

```bash
make check-renderer
make check-backend
```

Quality/test command interface for contributor and agent workflows is Makefile-only.

Backend Rust toolchain single source of truth is [`backend/rust-toolchain.toml`](backend/rust-toolchain.toml).
When bumping Rust, update that file first, then keep lockstep references aligned in:

- [`.github/workflows/ci-quality.yaml`](.github/workflows/ci-quality.yaml) (backend quality setup reads the pinned channel)
- [`agent/scripts/run-quality.sh`](agent/scripts/run-quality.sh) and [`agent/scripts/check-backend-coverage.sh`](agent/scripts/check-backend-coverage.sh) (backend quality commands)
- [`backend/Dockerfile`](backend/Dockerfile) (`ARG RUST_TOOLCHAIN`)

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

Current task aliases:

- `discuss-plan`: `discuss`, `go`, `1`
- `refine-plan`: `refine`, `split`, `2`
- `plan-item`: `plan`, `3`
- `implement-item`: `implement`, `do`, `4`
- `review-item`: `review`, `see`, `5`
- `finalize-plan`: `finalize`, `end`, `6`
- `review-architecture`: `review-arch`, `arch-review`, `7`
- `review-consistency`: `review-consistency`, `consistency-review`, `8`
- `review-quality`: `review-quality`, `quality-review`, `9`
- `review-security`: `review-security`, `security-review`, `10`
- `review-technology`: `review-technology`, `technology-review`, `tech-review`, `11`
- `freestyle`: `freestyle`, `free`, `12`
- `next-item`: `next`, `13`

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
make refresh-api-clients
```

Targeted commands:

- `make refresh-backend-api-client`
- `make refresh-frontend-api-client`
- `npm run generate:openapi` (from `renderer/`)

## Runtime and Operations

PumpBuddy ships two Docker Compose runtime files:

- Development/runtime from local source builds:
  - [`runtime/compose/compose.dev.yaml`](runtime/compose/compose.dev.yaml)
- Production/runtime from published GHCR images:
  - [`runtime/compose/compose.prod.yaml`](runtime/compose/compose.prod.yaml)

Operational quickstart:

- [`runtime/README.md`](runtime/README.md)

Database bootstrap files live in:

- [`runtime/database/00-schema.sql`](runtime/database/00-schema.sql) (schema only)
- [`runtime/database/10-seed-dev.sql`](runtime/database/10-seed-dev.sql) (dev seed data only)

Development quick run:

```bash
make run-app
```

Production run (required variables):

```bash
APP_VERSION=v1.2.3 POSTGRES_PASSWORD=change-me \
docker compose -f runtime/compose/compose.prod.yaml up -d
```

You can also copy and adjust [`runtime/compose/.env.prod.example`](runtime/compose/.env.prod.example)
to `runtime/compose/.env.prod` and run `docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml up -d`.

Before first production start, create the persistent postgres volume once:

```bash
docker volume create pumpbuddy-postgres-data
docker volume create pumpbuddy-bootstrap-secret-handoff
```

For updates, use:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml pull
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml up -d
```

Avoid `docker compose down --volumes` in production, as it removes database data volumes.

On first production startup, the one-shot `init-access-key` service creates an initial access key
only when the `users` table is empty and writes it to a one-time handoff file in a dedicated
volume. Retrieve it with:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml run --rm --no-deps --entrypoint /bin/cat init-access-key /bootstrap-secrets/initial-access-key
```

Rotate the bootstrap key immediately, then remove the handoff file:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml run --rm --no-deps --entrypoint /bin/sh init-access-key -lc 'rm -f /bootstrap-secrets/initial-access-key'
```

## Release

Releases are triggered via GitHub Actions `Release` workflow (`workflow_dispatch`) and semantic-release.
In the agent workflow, `finalize-plan` with `accept` triggers this workflow via `gh workflow run release.yaml --ref main` when `agent/execution/execution-config.yaml` has `release.trigger_on_finalize_accept: true`.

Release tooling is repository-managed and pinned via `package-lock.json`:

- install exact release dependencies: `npm ci`
- verify release resolution locally (dry-run): `npx semantic-release --dry-run`
- CI workflow uses `npm ci` and then `npm run release`

Published release images are pushed to GitHub Container Registry (GHCR):

- Backend image: `ghcr.io/<owner>/pumpbuddy-backend:<version>`
- Renderer image: `ghcr.io/<owner>/pumpbuddy-renderer:<version>`

`<version>` is the exact git tag produced by semantic-release (for example, `v1.2.3`).
The release workflow publishes the same tag string via `release_tag`, and both images are pushed with that value unchanged.

Pull examples:

```bash
docker pull ghcr.io/<owner>/pumpbuddy-backend:<version>
docker pull ghcr.io/<owner>/pumpbuddy-renderer:<version>
```

Use [`runtime/compose/compose.prod.yaml`](runtime/compose/compose.prod.yaml) for image-based deployment.
Boundary guidance: keep the backend private on the internal container network and expose only the renderer publicly.

## Project Status

PumpBuddy is in early iterative development with small, task-driven plan cycles.

## License

PumpBuddy is released under the **PolyForm Noncommercial License 1.0.0**.
Commercial use is not permitted without explicit permission from the licensor.
