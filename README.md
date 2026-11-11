# PumpBuddy

[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/christianpflugradt/PumpBuddy?display_name=tag&sort=semver)](https://github.com/christianpflugradt/PumpBuddy/releases/latest)
[![CI](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci.yml/badge.svg)](https://github.com/christianpflugradt/PumpBuddy/actions/workflows/ci.yml)
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

Use the published governor in [`.please-version`](.please-version).
Prepare tools/dependencies, then install managed hooks:

```sh
mise trust
mise install
mise run prepare
mise exec -- make install-git-hooks
```

Use `mise exec -- make check` for manual validation and `mise exec -- git commit` /
`mise exec -- git push` so hooks inherit the same configured tools without shell
activation. Plain commands require mise shell activation or equivalent PATH
setup; installing tools alone does not activate them. Git, Bash, make, a native
compiler/linker, stable Rust with rustfmt and Clippy, Docker with an accessible
daemon and the published governor remain host prerequisites; credentials remain
external. The Argon2 CLI is needed for explicit development access-key seeding.

Git hooks are the final local gates: pre-commit checks Rust formatting and framework
contracts; pre-push runs the complete local suite and Docker artifact builds.
Inspect captured failures with `please status --details`, fix them and retry Git.
Targeted checks remain available through `make check-backend`,
`make check-renderer`, `make check-framework` and `make check-release-artifacts`.
`make check` explicitly runs the complete local gate.

The Makefile is the contributor/agent quality command interface. Preparation is
separate from checks. Node, Python and standalone validation tools are pinned in
[`mise.toml`](mise.toml). CI reads the Node pin directly from that file.
Rust uses the host's stable compiler by default; CI explicitly selects `stable`.
No exact local compiler version is required. A project override
needs a concrete compatibility reason; nightly, beta and development compilers
are rejected by preparation and backend checks.

The backend Dockerfile retains its stable compiler version and image digest for
reproducible container builds. That release-build input is independent of the
host's numeric compiler version. The renderer builder remains aligned with Node.
On Nix-managed machines, host tools remain under the user's Nix configuration;
repository setup does not change Nix, invoke Homebrew or install global tools.
Checks do not install or silently replace tools.

See [repository governance](.please/README.md) for all rules, execution points,
prerequisites, offline test behavior and release guarantees.

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

The default execution lifecycle is `refine-plan → implement-item → holistic
finalize-plan review → stakeholder acceptance`. `plan-item` is optional for
complex work, and `review-item` is reserved for explicitly required focused
reviews.

## Validation and CI

Renovate merges its patch, minor, and digest dependency updates after CI checks
pass. GitHub Actions updates are grouped and also allow major updates to merge
automatically after a 14-day release cooldown. Other major updates and monthly
lockfile maintenance stay manual. Routine minor and patch updates keep their
7-day cooldown, and other majors keep their 14-day cooldown.

Renovate performs these merges itself (`platformAutomerge: false`) and rebases
branches that fall behind `main` before merging. GitHub-native auto-merge does
not need to be enabled. This policy applies to Renovate PRs only.

CI has a single `Check` job containing software and framework validation.
The independent `Coverage Badges` workflow calculates and publishes existing
GitHub Pages badges. Its publication queue is retained; quality CI does not write
badge files. Backend thresholds default to zero with an informational n/a fallback;
renderer coverage retains its configured thresholds.

## Commit Policy

Only the external Conventional Commits Check and advisory Gemini Flash-Lite
header Review run at commit-msg. Scopes are listed in
[.please/commit-scopes.txt](.please/commit-scopes.txt).
See [repository governance](.please/README.md) for provider setup and release semantics.

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

Production run:

```bash
cp runtime/compose/.env.example runtime/compose/.env.prod
$EDITOR runtime/compose/.env.prod
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml up -d
```

Production compose is intended to sit behind an external reverse proxy that terminates
TLS before traffic reaches PumpBuddy. The bundled stack binds the renderer upstream
to `127.0.0.1:8080` for that proxy hop and is not meant to be exposed directly on
the public internet.

You can also copy and adjust [`runtime/compose/.env.example`](runtime/compose/.env.example)
to `runtime/compose/.env.prod` and run `docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml up -d`.

Point the reverse proxy at `http://127.0.0.1:8080` on the Docker host.

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
volume. Sign in with login name `admin` and that access key. Retrieve it with:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml run --rm --no-deps --entrypoint /bin/cat init-access-key /bootstrap-secrets/initial-access-key
```

Rotate the bootstrap key immediately, then remove the handoff file:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml run --rm --no-deps --entrypoint /bin/sh init-access-key -lc 'rm -f /bootstrap-secrets/initial-access-key'
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml run --rm --no-deps --entrypoint /bin/sh init-access-key -lc 'test ! -e /bootstrap-secrets/initial-access-key'
```

## Release

The manual GitHub Actions `Release` workflow uses `release.yml`;
accepted `finalize-plan` automation can still trigger it. Plan determines the
next version/source SHA. Release Readiness and Release Candidate run in parallel.
Publish requires both and publishes the exact exported candidate images without
rebuilding. Changes to main or the planned version refuse publication.

Both published images remain **linux/amd64**:

- `ghcr.io/christianpflugradt/pumpbuddy-backend:v<version>`
- `ghcr.io/christianpflugradt/pumpbuddy-renderer:v<version>`

The version is the exact Semantic Release tag, such as `v4.3.4`.
The stable series, GitHub release notes and production Compose consumers remain.
See [repository governance](.please/README.md) for release policy, CI evidence,
artifact provenance, permissions and partial-publication limitations.

## License

PumpBuddy is released under the **PolyForm Noncommercial License 1.0.0**.
Commercial use is not permitted without explicit permission from the licensor.
