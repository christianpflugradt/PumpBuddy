# Item: Hello World End-to-End Slice

## Goal

Deliver the bootstrap Hello World flow end to end so the renderer displays a backend value that is sourced from PostgreSQL.

## Scope

- add backend `GET /api/hello-world` contract implementation
- persist/read Hello World value through PostgreSQL via SQLx
- ensure bootstrap data exists so the endpoint is functional on first startup
- return API response shape aligned with `HelloWorldResponse`
- keep renderer behavior aligned with contract and verify it displays the API value

## Acceptance Criteria

- `docker compose up --build -d` starts renderer, backend, and postgres successfully
- `curl --fail --silent http://localhost:8080/api/hello-world` returns a JSON object with `value` sourced from the database
- changing the first database row value is reflected by the API response after the change
- renderer displays the value returned by `GET /api/hello-world` when loaded in browser through renderer

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `agent/design/api-contract.yaml`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`


## Review Acceptance

- Criteria Met: All item acceptance criteria are satisfied: compose startup succeeds, `/api/hello-world` returns JSON with DB-backed `value`, DB first-row updates are reflected by API output, and renderer fetches from the contract endpoint and renders the returned `value`.
- Evidence: Backend implements `/api/hello-world` with SQLx query against `hello_world` table and startup seeding (`backend/src/main.rs`), renderer fetches `/api/hello-world` and assigns `messageElement.textContent` from response value (`renderer/src/main.ts`), and compose topology keeps renderer public with backend/postgres internal (`compose.yaml`).
- Runtime/Build Check: Executed `docker compose up --build -d`, `curl --fail --silent http://localhost:8080/api/hello-world`, `docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy -c "UPDATE hello_world SET value='Hello Compose' WHERE id=(SELECT id FROM hello_world ORDER BY id ASC LIMIT 1);"`, and `curl --fail --silent http://localhost:8080/api/hello-world`; observed successful startup and response change from `{"value":"Hello World"}` to `{"value":"Hello Compose"}`.
- Residual Risk: Low; backend currently returns generic internal error on missing DB row/query failure, acceptable for bootstrap slice but should be refined in later plans.
