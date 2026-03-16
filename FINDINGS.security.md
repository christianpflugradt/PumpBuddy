# Extended Review Findings

Review Task: review-security

Summary:

- 1 finding identified
- overall readiness: follow-up work recommended before acceptance

<!-- FINDING -->
# Privileged maintenance path is not isolated to a backend-local CLI boundary
Priority: P1

## Summary

The current implementation does not provide a dedicated backend-container-local CLI path for privileged credential maintenance, so high-trust access management remains coupled to general scripts and direct database operations.

## Evidence

- `agent/scripts/seed-dev-access-key.sh` performs privileged auth-state updates by executing `psql` directly against the database container from the host context.
- `backend/src/main.rs` only boots the HTTP server and `--help`; there is no dedicated maintenance command surface.
- `backend/src/api/handlers.rs` exposes product API and auth/session routes, but no explicit separation for an administrative API surface versus privileged local-only maintenance operations.
- `backend/src/bin/**/*.rs` is absent, indicating no separate backend CLI binary for token/secret lifecycle operations.

## Goal

Establish an explicit privileged maintenance access path that is local-only inside the backend container runtime and separate it from normal product/API access paths.

## Implementation Direction (Agreed)

Implement privileged maintenance as a backend-owned CLI tool that is packaged in the backend Docker image and invoked from inside the backend container runtime (for example via `docker exec` into backend), not as a host-side DB script.

## Scope

- add a backend-local maintenance CLI command surface (for example under `backend/src/bin/`) for secret/token lifecycle actions
- ensure the maintenance CLI is built into and shipped with the backend Docker image
- move privileged auth-maintenance operations from host-level direct DB scripting to backend-container-local execution via backend CLI commands
- keep privileged maintenance actions inaccessible from public renderer routes and normal user-facing API endpoints
- document the operational runbook for invoking maintenance commands via container-local execution

## Acceptance Criteria

- privileged credential maintenance operations can be executed through a backend-local CLI command path
- maintenance command binaries are available inside the backend Docker image/runtime
- no public HTTP endpoint is introduced for privileged maintenance actions
- normal workout API routes and privileged maintenance operations remain operationally and code-path separated
- repository documentation describes the supported local-only invocation flow (for example `docker exec` into backend container)

## References

- `agent/strategy/security.md`
- `agent/scripts/seed-dev-access-key.sh`
- `backend/src/main.rs`
- `backend/src/api/handlers.rs`
<!-- END FINDING -->
