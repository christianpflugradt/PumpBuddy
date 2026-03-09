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
