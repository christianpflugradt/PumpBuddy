# PumpBuddy

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
Task: <task-name>
```

Example:

```text
Task: implement-item
```

This maps to deterministic task resolution through `agent/scripts/tasks.sh <task-name>`.

### Available Tasks

Core tasks:

| Step | Full Task Name | Accepted Aliases | Purpose |
| --- | --- | --- | --- |
| 1 | `discuss-plan` | `discuss`, `1` | align plan scope/content with the stakeholder and estimate expected item count |
| 2 | `refine-plan` | `refine`, `2` | break the active plan into small, implementation-ready execution items |
| 3 | `plan-item` | `plan`, `3` | create or update an optional lightweight implementation plan for the next open item |
| 4 | `implement-item` | `implement`, `do`, `4` | implement the next open execution item |
| 5 | `review-item` | `review`, `5` | review the next item in review state and either accept or return it with findings |
| 6 | `finalize-plan` | `finalize`, `6` | archive the completed active plan and its items, then bootstrap a fresh plan template |

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

## License

PumpBuddy is released under the **PolyForm Noncommercial License 1.0.0**.

The software may be used for personal and non-commercial purposes.
Commercial use is not permitted without explicit permission from the licensor.
