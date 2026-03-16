# Extended Review Findings

Review Task: review-security

Summary:

- 2 findings identified
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

## Scope

- add a backend-local maintenance CLI command surface (for example under `backend/src/bin/`) for secret/token lifecycle actions
- move privileged auth-maintenance operations from host-level direct DB scripting to backend-container-local execution
- keep privileged maintenance actions inaccessible from public renderer routes and normal user-facing API endpoints
- document the operational runbook for invoking maintenance commands via container-local execution

## Acceptance Criteria

- privileged credential maintenance operations can be executed through a backend-local CLI command path
- no public HTTP endpoint is introduced for privileged maintenance actions
- normal workout API routes and privileged maintenance operations remain operationally and code-path separated
- repository documentation describes the supported local-only invocation flow (for example `docker exec` into backend container)

## References

- `agent/strategy/security.md`
- `agent/scripts/seed-dev-access-key.sh`
- `backend/src/main.rs`
- `backend/src/api/handlers.rs`
<!-- END FINDING -->

<!-- FINDING -->
# Cleartext default database credentials are committed across runtime configuration
Priority: P2

## Summary

Committed runtime files use cleartext static database credentials (`pumpbuddy:pumpbuddy`), which weakens secret-handling posture and increases accidental reuse risk outside strictly local development.

## Evidence

- `docker-compose.yml` defines `DATABASE_URL` for backend and `POSTGRES_USER`/`POSTGRES_PASSWORD` in cleartext.
- `backend/.env` is tracked and contains a cleartext database URL credential.
- `backend/test.env` stores test DB credentials in cleartext.
- `README.md` documents direct database commands using the same static credentials.

## Goal

Shift database credential handling to environment-injected, non-committed secret values while retaining local developer ergonomics.

## Scope

- replace committed credential values with templated examples (`.env.example`) and runtime-injected values
- keep real local values in ignored `.env` files, not tracked repository files
- update compose/test setup to fail fast when required secrets are missing rather than silently using shared defaults
- update developer docs to reference secret injection workflow instead of hardcoded credentials

## Acceptance Criteria

- repository no longer contains committed real credential values in runtime config files
- local and test startup still work via developer-provided environment files that are git-ignored
- compose configuration validates required credential variables at startup
- docs include a clear setup flow for local credential provisioning

## References

- `docker-compose.yml`
- `backend/.env`
- `backend/test.env`
- `README.md`
- `agent/strategy/security-baseline.md`
<!-- END FINDING -->
