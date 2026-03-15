# Plan: Deliver Renderer Installable PWA Baseline

## Item Reference

- `agent/execution/open-item-06.md`

## Goal Summary

Provide the renderer with the minimal installable PWA shell assets and metadata (manifest + icons + HTML wiring) while explicitly avoiding service worker or offline caching behavior.

## Implementation Approach

- Add `renderer/public/manifest.webmanifest` with name, short_name, start_url, display mode, theme/background color, and icon references aligned to PumpBuddy branding.
- Add required icon assets under `renderer/public/` (or existing static asset location used by Vite) so they are copied into renderer build output with stable filenames.
- Update `renderer/index.html` to include a `<link rel="manifest" href="/manifest.webmanifest">` and any minimal related metadata required for installability (for example theme color).
- Verify renderer build output contains manifest and referenced icons, and confirm no service worker registration is introduced in `renderer/src/main.ts` or elsewhere.
- Validate runtime exposure through compose stack by loading `http://localhost:8080/manifest.webmanifest` after `docker compose up --build -d`.

## Risks and Assumptions

- Icon dimensions or MIME expectations may vary by browser installability checks; use common sizes and PNG format to reduce compatibility risk.
- Container runtime static file serving behavior is assumed to map renderer build artifacts directly to the public root.
- Existing renderer branding values are assumed to be available or can be represented with neutral defaults without changing scope.

## Validation Plan

- Run `npm --prefix renderer run build` and confirm successful build.
- Inspect renderer build artifacts to confirm `manifest.webmanifest` and referenced icon files are present.
- Run `docker compose up --build -d` and request `http://localhost:8080/manifest.webmanifest`, expecting HTTP 200 and manifest content.
- Search code for service worker registration additions and confirm none were introduced by this item.

## Out of Scope

- Any service worker registration, runtime caching, offline-first behavior, background sync, or queueing.
- Changes to broader renderer architecture or non-PWA feature work.

## Handoff Notes for Implementation

- Keep `renderer/src/main.ts` as a thin bootstrap entrypoint; place any new static metadata in public assets and HTML wiring rather than runtime logic.
- Follow existing project naming/layout conventions for static assets to avoid incidental refactors.
- If installability metadata requires minor values not yet defined, prefer conservative defaults that do not expand item scope.
