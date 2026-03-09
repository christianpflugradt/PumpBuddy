# Item 0002 - Renderer Dockerfile and Runtime Entrypoint

## Goal

Provide a renderer Dockerfile and runtime entrypoint configuration that serves the frontend and forwards API traffic to the internal backend service.

## Scope

- add a renderer Dockerfile in the renderer project area
- include build steps for frontend assets
- configure runtime serving/proxy behavior for `/api` traffic to the backend container hostname

## Acceptance Criteria

- `docker compose build renderer` completes successfully using the repository Dockerfile.
- `docker compose run --rm renderer caddy validate --config /etc/caddy/Caddyfile` (or equivalent renderer runtime validation command) exits successfully.
- renderer runtime config does not publish or proxy direct database access.

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/design/use-cases.md`
- `agent/design/api-contract.yaml`

## Dependencies

- `item-0001`


## Review Acceptance

- Criteria Met: Renderer Dockerfile exists under renderer, builds frontend assets via Vite in a multi-stage build, Caddy runtime serves built assets, and `/api/*` is proxied to `backend:8080` without any database proxy/exposure path.
- Evidence: `renderer/Dockerfile` defines Node build stage (`npm install`, `npm run build`) and Caddy runtime stage; `renderer/Caddyfile` serves `/srv` and proxies only `@api path /api/*` to `backend:8080`; `docker-compose.yml` exposes only renderer port `8080:80` and keeps backend internal.
- Runtime/Build Check: `docker compose build renderer` exited 0 and produced `pumpbuddy-renderer  Built`; `docker compose run --rm renderer caddy validate --config /etc/caddy/Caddyfile` exited 0 with `Valid configuration`.
- Residual Risk: none identified.
