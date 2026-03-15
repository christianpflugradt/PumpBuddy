# Deliver Renderer Installable PWA Baseline

## Goal

Enable renderer installation as a minimal PWA app shell with required manifest and static assets, without introducing offline runtime behavior.

## Scope

- add a web app manifest with install metadata appropriate for PumpBuddy renderer
- provide required static icons/assets and ensure they are included in renderer build output
- wire manifest and related metadata into renderer entry HTML so install prompts can function in supported browsers
- keep service-worker/offline caching out of this item

## Acceptance Criteria

- renderer build output includes a valid `manifest.webmanifest` and referenced icon assets
- running `npm --prefix renderer run build` succeeds and emits the PWA baseline assets
- running `docker compose up --build -d` followed by loading `http://localhost:8080/manifest.webmanifest` returns the manifest with HTTP 200 in the containerized runtime
- repository contains no registered service worker or offline cache strategy added by this item

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `renderer/index.html`
- `renderer/src/main.ts`
- `renderer/Dockerfile`
- `docker-compose.yml`

## Out of Scope

- offline-first support, runtime caching, sync queues, or background sync
