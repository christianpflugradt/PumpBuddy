# PumpBuddy

[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg)](LICENSE)
[![CI](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci-quality.yml/badge.svg)](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci-quality.yml)
[![Backend Coverage](https://img.shields.io/endpoint?url=https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json&cacheSeconds=300)](https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json)
[![Renderer Coverage](https://img.shields.io/endpoint?url=https://christianpflugradt.github.io/PumpBuddy/badges/renderer-coverage.json&cacheSeconds=300)](https://christianpflugradt.github.io/PumpBuddy/badges/renderer-coverage.json)

PumpBuddy is a personal training companion designed to support structured strength training in the gym.
The project focuses on simplicity, clarity, and long‑term maintainability while providing a smooth training workflow during workouts.

## Product Idea

PumpBuddy helps a single user manage workout plans and record training sessions with minimal friction.
The application guides the user through exercises during a workout and keeps track of weights, variations, and progress over time.

Core principles:

- fast interaction during workouts
- minimal manual input
- clear structure of training plans and exercises
- reliable tracking of training data

PumpBuddy is intentionally designed as a personal tool rather than a social or commercial fitness platform.

## Architecture Overview

PumpBuddy follows a simple service-oriented architecture consisting of three components:

- Renderer (Web Application) – serves the user interface and communicates with the backend
- Backend Service – implements application logic and the API
- Database – stores plans, exercises, sessions, and related data

Only the renderer is exposed to the internet.
Backend and database services communicate internally within the container environment.

## Technology Stack

The project uses a deliberately small and stable technology stack.

- Frontend: TypeScript-based web application using Web Components
- Backend: Rust-based API service
- Database: PostgreSQL
- Deployment: containerized services

The stack prioritizes long-term maintainability, performance, and clear system boundaries.

## AI‑Assisted Development

PumpBuddy is developed using an AI-assisted workflow.

Plans and product direction are defined by the project owner.
AI agents support the development process through:

- backlog refinement
- implementation of tasks
- structured reviews and consistency checks

The workflow is task-based (not role-based): each task run starts with fresh context and derives behavior from the invoked task.

Fresh context is especially important when switching perspective between tasks (for example implementation to review) to avoid carry-over bias and reduce review errors.

### How Task Interaction Works

Agent interaction is done by invoking a task command in this format:

```text
Task: <task-name|alias|number>
```

or

```text
T: <task-name|alias|number>
```

Prefix matching is case-insensitive (`Task:`/`task:` and `T:`/`t:` are equivalent).

Example:

```text
Task: implement-item
```

```text
T: do
```

```text
t: go
```

This maps to deterministic task resolution through `agent/scripts/tasks.sh <task-name|alias|number>`.

### Available Tasks

Core tasks:

| Step | Full Task Name | Accepted Aliases | Purpose |
| --- | --- | --- | --- |
| 1 | `discuss-plan` | `discuss`, `go`, `1` | align plan scope/content with the stakeholder and estimate expected item count |
| 2 | `refine-plan` | `refine`, `split`, `2` | break the active plan into small, implementation-ready execution items |
| 3 | `plan-item` | `plan`, `3` | create or update an optional lightweight implementation plan for the next open item |
| 4 | `implement-item` | `implement`, `do`, `4` | implement the next open execution item |
| 5 | `review-item` | `review`, `see`, `5` | review the next item in review state and either accept or return it with findings |
| 6 | `finalize-plan` | `finalize`, `end`, `6` | ask for stakeholder acceptance, then either archive the completed plan or turn blocking findings into new open items |

Extended review tasks:

- `review-consistency` – check cross-artifact consistency and drift between plan, items, and current state. The task writes prioritized findings to `FINDINGS.md`, asks the stakeholder to review them, and can create backlog items from an approved severity selection before removing `FINDINGS.md`.
- `review-architecture` – review structure, boundaries, layering, and dependency direction. The task writes prioritized findings to `FINDINGS.md`, asks the stakeholder to review them, and can create backlog items from an approved severity selection before removing `FINDINGS.md`.
- `review-technology` – review stack/tooling adherence against the defined technology baseline. The task writes prioritized findings to `FINDINGS.md`, asks the stakeholder to review them, and can create backlog items from an approved severity selection before removing `FINDINGS.md`.
- `review-quality` – review test confidence, reliability, maintainability, and practical quality posture. The task writes prioritized findings to `FINDINGS.md`, asks the stakeholder to review them, and can create backlog items from an approved severity selection before removing `FINDINGS.md`.
- `review-security` – review trust boundaries, access separation, secret handling, and exposure risks. The task writes prioritized findings to `FINDINGS.md`, asks the stakeholder to review them, and can create backlog items from an approved severity selection before removing `FINDINGS.md`.

This approach combines human architectural control with AI-assisted productivity.

## Release Workflow

Releases are no longer triggered by a time-based schedule.
Semantic-release runs when the `Release` GitHub Actions workflow is triggered manually (`workflow_dispatch`) or when plan finalization automation dispatches that workflow after successful finalize completion.

## Conventional Commit Types

PumpBuddy uses Conventional Commits for release analysis and release notes generation.

Commit scope is optional. When a scope is used, it must be one of these artifact-aligned scopes only:

- `renderer`
- `backend`
- `docker`
- `database`
- `api`
- `deps`

Do not invent additional scopes, and do not use scopes that overlap with commit types.

- `feat`
- `fix`
- `perf`
- `chore`
- `build`
- `ci`
- `refactor`
- `style`
- `test`
- `docs` (excluded from release notes)

## Project Status

PumpBuddy is in early development and evolves incrementally through small plans.
The core system architecture is established first while the domain model grows step by step.

## Local Quality Check

Run the repository-wide quality checks from the repository root with:

```bash
make check
```

This runs the same critical categories enforced by CI in order: backend validation, backend tests, backend performance smoke, renderer validation, and renderer tests.
It no longer requires a follow-up commit when coverage badge artifacts are regenerated locally.

For task-scoped local validation, you can also run:

```bash
agent/scripts/run-quality.sh changed
```

That command inspects the current worktree and runs only the backend and/or renderer quality suite that corresponds to the changed code paths. If the worktree only contains agent, documentation, or other non-code changes, it skips codebase tests.

## Agent Framework Validation

The agent framework is validated separately from backend/renderer runtime quality.

Run from repository root:

```bash
agent/scripts/check/validate-docs.sh
```

This validates:

- all registered YAML contracts in `agent/**` against Pydantic models
- all registered example YAML files in `validation/examples/**`
- cross-document consistency checks for design docs (glossary, domain model, persistence model, capabilities, use cases, mappings)
- execution item invariants (`open/review/done` filename-state consistency and item schema checks)
- shell script linting via `shellcheck` for `.githooks/*.sh` and `agent/scripts/**/*.sh` (local run warns and skips if `shellcheck` is missing)

Task contract integrity can be checked with:

```bash
agent/scripts/check/check-task-contract.sh <task-name>
```

The CI workflow **Agent Framework Quality** runs these checks independently from **CI Quality**, so software quality and framework drift remain visible as separate statuses.

### Backend Performance Smoke Baseline

The backend quality suite includes a lightweight latency smoke check for the critical `/health` runtime path. It runs the `health_endpoint_latency_smoke` test and fails when the average in-process response time exceeds the threshold.

Threshold policy:

- default maximum average latency is `50ms` across `40` requests
- the threshold can be overridden for local environments with `BACKEND_HEALTH_LATENCY_SMOKE_MAX_MS`

Run only the performance baseline with:

```bash
agent/scripts/run-quality.sh performance
```

Prerequisites:

- Python 3 available on `PATH` for the backend coverage summary and badge endpoint generation scripts
- backend Rust tooling installed locally, including `cargo-llvm-cov` and the `llvm-tools-preview` component required by `agent/scripts/check-backend-coverage.sh`
- renderer dependencies installed in `renderer/` with `npm ci`

## OpenAPI Model Generation

The canonical API contract is `agent/design/api-contract.yaml`.

Generate backend and renderer OpenAPI models from that single contract with:

```bash
make generate-openapi
```

Targeted commands are also available:

- `make generate-openapi-backend`
- `make generate-openapi-renderer`
- `npm run generate:openapi` (from `renderer/`)

These commands are deterministic and always regenerate outputs in place:

- backend models: `backend/target/generated/openapi/rust/`
- renderer models: `renderer/dist/generated/openapi/typescript/`

Generated OpenAPI artifacts are build outputs and are not committed by default. Regenerate them from the checked-in contract with the commands above in local workflows and CI.

Prerequisite:

- Docker must be available locally (the generator runs via `openapitools/openapi-generator-cli`)

## Managed Pre-Push Hook

Enable the repository-managed `pre-push` hook from the repository root with:

```bash
make install-git-hooks
```

This configures `core.hooksPath` for the current clone to use the tracked `.githooks/` directory. After that, every `git push` runs a change-aware quality pass before Git contacts the remote: backend checks only for backend changes, renderer checks only for renderer changes, both suites when both code areas changed, and no codebase tests for agent/documentation-only pushes.

The pre-push hook uses the same local prerequisites as `make check`.

## Coverage Badge Publication

Coverage badges are published from GitHub Actions to the default project Pages site at `https://christianpflugradt.github.io/PumpBuddy/`.
The `CI Quality` workflow runs backend and renderer quality checks, generates coverage endpoint JSON files under `site/badges/`, and publishes them to Pages for Shields.

To prepare the same Pages payload locally, run:

```bash
agent/scripts/prepare-pages-artifacts.sh
```

## Local Stack Commands

Use the Makefile shortcuts when you want to start or fully reset the local Docker Compose stack during development:

- `make run-app` starts the existing stack in detached mode without rebuilding images. Use it for normal local startup when your containers and database state can be reused.
- `make rebuild-app` removes the stack and volumes, rebuilds images from scratch, recreates services, then seeds one development Access Key (printed once in CLI output) while storing only its Argon2id hash in PostgreSQL.
- `make stop-app` stops running services without removing volumes.

For build, reachability, and teardown verification details, see [Compose Runtime Verification](#compose-runtime-verification).

## Development Access Key Seeding Verification

Run this from the repository root:

```bash
make rebuild-app
```

Expected result:

- the command prints exactly one `Development Access Key: ...` line
- database state contains one active user secret hash and no cleartext key material

Optional DB check:

```bash
docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy -c "SELECT user_id, secret_hash, revoked_at FROM user_secrets ORDER BY created_at DESC LIMIT 3;"
```

## Compose Runtime Verification

Use these commands on a clean checkout to verify the Compose baseline for build, startup, renderer reachability, and teardown.

1. Build images and start the stack in detached mode:

```bash
docker compose up --build -d
```

2. Verify runtime status and service exposure:

```bash
docker compose ps
```

Expected result: `renderer` is running and publishes `0.0.0.0:8080->80/tcp`; `backend` and `postgres` are running without published host ports.

3. Verify renderer reachability through the public entrypoint (bounded readiness check):

```bash
for attempt in {1..30}; do
  if curl --fail --show-error --silent http://localhost:8080 >/dev/null; then
    echo "renderer reachable"
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "renderer not reachable after 30s" >&2
    exit 1
  fi
  sleep 1
done
```

4. Tear down the stack after verification:

```bash
docker compose down
```

Optional cleanup (remove database volume as well):

```bash
docker compose down --volumes
```

## Compose Test Verification

Run backend tests in a dedicated test container (instead of the production backend runtime image):

```bash
docker compose --profile test up --build --abort-on-container-exit --exit-code-from backend-test backend-test
```

This command starts `postgres-test`, waits for health, runs `cargo test` in `backend-test`, and returns the test exit code.

Cleanup after test execution:

```bash
docker compose --profile test down
```

## License

PumpBuddy is released under the **PolyForm Noncommercial License 1.0.0**.

The software may be used for personal and non-commercial purposes.
Commercial use is not permitted without explicit permission from the licensor.
