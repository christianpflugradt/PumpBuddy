# Plan: Compose Runtime Baseline

## Plan ID

plan-0001

## Goal

Establish a reproducible Docker Compose runtime baseline for the project so renderer, backend, and database can be built and started together from repository sources.

## Scope

- provide Dockerfiles for renderer and backend services
- provide a project-owned Docker Compose setup that runs renderer, backend, and database together
- ensure the services can be built through Docker Compose without requiring prebuilt images
- ensure service wiring and startup ordering are stable for renderer, backend, and database
- ensure renderer is reachable as the public entrypoint while backend and database remain internal within the Compose network
- provide minimal runtime verification commands for build/startup/reachability checks of the Compose stack

## Out of Scope

- Hello World end-to-end feature delivery through API and database
- API contract implementation details beyond what is required for runtime wiring
- application feature development beyond runtime baseline setup
- reverse-proxy configuration outside this repository
- server-specific operations and deployment validation

## Success Criteria

- `docker compose up --build` builds renderer and backend from repository Dockerfiles
- the Docker Compose stack runs renderer, backend, and database together as the project runtime baseline
- renderer endpoint is reachable when the Compose stack is running
- backend and database are not exposed as public entrypoints through Compose port publishing
- the repository contains explicit commands to verify build/startup/reachability of the Compose baseline

## Constraints

- keep architecture aligned with `agent/strategy/tech-stack.md`
- keep security boundaries aligned with `agent/strategy/security-baseline.md` and `agent/strategy/security.md`
- keep implementation minimal and focused on runtime baseline setup
- keep Docker Compose as a project-native local/runtime orchestration entrypoint for this plan
- avoid coupling this plan to feature-level API or domain logic delivery

## Inputs

- `agent/strategy/tech-stack.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
