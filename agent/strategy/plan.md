# Plan: Hello World Technical Slice

## Goal

Deliver the first end-to-end technical slice for the project by implementing the Hello World use case from renderer through backend to database.

## Scope

- implement the bootstrap flow described in `agent/design/use-cases.md`
- expose `GET /api/hello-world` as defined in `agent/design/api-contract.yaml`
- read the Hello World value from database through backend
- return the value via API and display it in the renderer
- provide Dockerfiles for renderer and backend services
- provide a project-owned Docker Compose setup that runs renderer, backend, and database together
- ensure the services can be built through Docker Compose without requiring prebuilt images

## Out of Scope

- authentication and authorization
- workout domain logic
- user-specific behavior
- broader product features beyond the bootstrap Hello World flow
- reverse-proxy configuration outside this repository
- server-specific operations and deployment validation

## Success Criteria

- renderer calls `GET /api/hello-world` successfully
- backend responds with the value from persistent storage (not hardcoded)
- renderer displays the returned value
- behavior matches the active use case and API contract
- `docker compose up --build` builds renderer and backend from repository Dockerfiles
- the Docker Compose stack runs renderer, backend, and database together as the project runtime baseline

## Constraints

- keep architecture aligned with `agent/strategy/tech-stack.md`
- keep security boundaries aligned with `agent/strategy/security-baseline.md` and `agent/strategy/security.md`
- keep implementation minimal and focused on the bootstrap slice
- keep Docker Compose as a project-native local/runtime orchestration entrypoint for this slice

## Inputs

- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `agent/design/api-contract.yaml`
- `agent/strategy/tech-stack.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
