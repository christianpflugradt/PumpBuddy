# PumpBuddy

[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg)](LICENSE)
[![CI](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci-quality.yml/badge.svg)](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci-quality.yml)
[![Backend Coverage](https://img.shields.io/endpoint?url=https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json)](https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json)
[![Renderer Coverage](https://img.shields.io/endpoint?url=https://christianpflugradt.github.io/PumpBuddy/badges/renderer-coverage.json)](https://christianpflugradt.github.io/PumpBuddy/badges/renderer-coverage.json)

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
| 6 | `finalize-plan` | `finalize`, `end`, `6` | archive the completed active plan and its items, then bootstrap a fresh plan template |

Extended review tasks:

- `review-consistency` – check cross-artifact consistency and drift between plan, items, and current state.
- `review-architecture` – review structure, boundaries, layering, and dependency direction.
- `review-technology` – review stack/tooling adherence against the defined technology baseline.
- `review-quality` – review test confidence, reliability, maintainability, and practical quality posture.
- `review-security` – review trust boundaries, access separation, secret handling, and exposure risks.

This approach combines human architectural control with AI-assisted productivity.

## Project Status

PumpBuddy is in early development and evolves incrementally through small plans.
The core system architecture is established first while the domain model grows step by step.

## Local Quality Check

Run the repository-wide quality checks from the repository root with:

```bash
make check
```

This runs the same critical categories enforced by CI in order: backend validation, backend tests, backend coverage, renderer validation, renderer tests, and renderer coverage.
It no longer requires a follow-up commit when coverage badge artifacts are regenerated locally.

Prerequisites:

- Python 3 available on `PATH` for the backend coverage summary and badge endpoint generation scripts
- backend Rust tooling installed locally, including `cargo-llvm-cov` and the `llvm-tools-preview` component required by `agent/scripts/check-backend-coverage.sh`
- renderer dependencies installed in `renderer/` with `npm ci`

## Managed Pre-Push Hook

Enable the repository-managed `pre-push` hook from the repository root with:

```bash
make install-git-hooks
```

This configures `core.hooksPath` for the current clone to use the tracked `.githooks/` directory. After that, every `git push` runs `agent/scripts/run-quality.sh check` before Git contacts the remote, so stale required artifacts or failing checks block the push locally.

You can inspect the active hook path with:

```bash
make git-hooks-status
```

The pre-push hook uses the same local prerequisites as `make check`.

## Coverage Badge Publication

Coverage badges are published from GitHub Actions to the default project Pages site at `https://christianpflugradt.github.io/PumpBuddy/`.
The `Coverage Badges Pages` workflow runs `agent/scripts/prepare-pages-artifacts.sh`, which regenerates the backend and renderer coverage endpoint JSON files under `site/badges/` for Shields.

To prepare the same Pages payload locally, run:

```bash
agent/scripts/prepare-pages-artifacts.sh
```

## Local Stack Commands

Use the Makefile shortcuts when you want to start or fully reset the local Docker Compose stack during development:

- `make compose-up` starts the existing stack in detached mode without rebuilding images. Use it for normal local startup when your containers and database state can be reused.
- `make compose-reset` removes the current stack, deletes Compose-managed volumes, rebuilds images from scratch, and recreates the services. Use it when you need a clean local environment with fresh database initialization.

For build, reachability, and teardown verification details, see [Compose Runtime Verification](#compose-runtime-verification).

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
