# Plan: Backend Dockerfile Baseline

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Define a backend Dockerfile that builds the Rust backend from repository sources and runs it in a container-ready runtime configuration for local Docker Compose usage.

## Implementation Approach

- Add `backend/Dockerfile` with a multi-stage build:
- builder stage compiles the backend binary from repository sources with Rust tooling.
- runtime stage copies only required runtime artifacts and the backend binary.
- Configure runtime defaults for container execution (`0.0.0.0` bind and expected backend port) through environment variables or command arguments.
- Keep the image self-contained so `docker compose build backend` uses only repository files and does not depend on external prebuilt backend images.

## Risks and Assumptions

- Rust crate paths, workspace layout, or lockfile location may require specific `COPY` ordering in Dockerfile for reliable caching and successful builds.
- Runtime base image must include any dynamic libraries required by the compiled backend binary.
- Existing backend CLI flags and config handling are assumed to support a non-interactive container startup path and a help command.

## Validation Plan

- Run `docker compose build backend` and confirm backend image builds from repository sources.
- Run `docker compose run --rm backend --help` (or the backend binary help command) and confirm successful exit.
- Verify Dockerfile stages and image references do not require external prebuilt backend images.

## Out of Scope

- Implementing backend feature logic or API behavior changes.
- Modifying renderer or database container behavior beyond backend image integration needs.
- Adding production deployment hardening beyond local Compose baseline requirements.

## Handoff Notes for Implementation

- Keep the Dockerfile minimal and aligned with the existing Rust/SQLx/Axum stack conventions.
- Preserve internal-network assumptions where backend is container-internal and renderer remains the public entrypoint.
- If tests are not added, document why (container baseline/config-only scope).
