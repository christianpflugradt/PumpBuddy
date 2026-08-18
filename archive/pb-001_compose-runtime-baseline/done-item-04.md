# Item 0004 - Compose Runtime Verification Commands

## Goal

Document a minimal, reproducible command sequence for verifying build, startup, and renderer reachability of the Compose runtime baseline.

## Scope

- add or update project documentation with runtime verification steps
- include commands for build/start, service status, reachability check, and teardown
- keep instructions aligned with the Compose topology and security boundaries

## Acceptance Criteria

- documentation includes executable commands for `docker compose up --build`, runtime status checks, renderer reachability check (for example `curl`), and stack teardown.
- following the documented command sequence on a clean checkout produces a running stack and successful renderer reachability response.
- verification instructions do not require exposing backend or database ports publicly.

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-03`


## Review Findings

### Criterion

Following the documented command sequence on a clean checkout produces a running stack and successful renderer reachability response.

- Status: fail
- Evidence: Executed the documented sequence in `repo root`: `docker compose up --build -d && docker compose ps && curl --fail --show-error --silent http://localhost:8080 >/dev/null; EXIT_CODE=$?; docker compose down; exit $EXIT_CODE`. `docker compose up --build -d` and `docker compose ps` succeeded, but the reachability check failed with `curl: (7) Failed to connect to localhost port 8080 after 0 ms: Couldn't connect to server`.
- Risk: The verification flow is not reproducible as written because a renderer readiness race can cause false failures on clean runs; this blocks acceptance for a deterministic runtime verification baseline.


## Review Acceptance

- Criteria Met: Runtime verification documentation now includes executable commands for `docker compose up --build -d`, `docker compose ps`, a bounded renderer reachability `curl` loop, and `docker compose down`; executing the documented sequence produced a running stack and successful renderer reachability without exposing backend or postgres host ports.
- Evidence: `README.md` documents a four-step Compose verification flow including bounded readiness handling; `compose.yaml` publishes `8080:80` only for `renderer` while `backend` and `postgres` have no `ports` mapping.
- Runtime/Build Check: Executed `docker compose up --build -d && docker compose ps && for attempt in {1..30}; do if curl --fail --show-error --silent http://localhost:8080 >/dev/null; then echo "renderer reachable"; break; fi; if [ "$attempt" -eq 30 ]; then echo "renderer not reachable after 30s" >&2; exit 1; fi; sleep 1; done && docker compose down`; observed result: services started, `docker compose ps` showed only renderer publishing `0.0.0.0:8080->80/tcp`, reachability check printed `renderer reachable`, and teardown completed.
- Residual Risk: none identified.
