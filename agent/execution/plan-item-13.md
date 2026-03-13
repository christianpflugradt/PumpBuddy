# Plan: Renderer implementation bypasses the required Web Components and SCSS baseline

## Item Reference

- Stable item id: `item-13`

## Goal Summary

Align the renderer with the required frontend baseline by moving the top-level app entry to a custom element and migrating authored styles from CSS to SCSS while preserving the current workout flow and build/test behavior.

## Implementation Approach

- add a top-level app shell custom element in `renderer/src/` that owns bootstrap, rendering, and event wiring, then update `renderer/src/main.ts` to register and mount that element instead of querying `.app` directly
- keep the current workout logic centered in `renderer/src/app.ts`, extracting only the DOM container assumptions needed so the custom element can host the existing UI without a broader state-management rewrite
- rename or replace `renderer/src/styles.css` with an SCSS entry file, keep the current visual design intact, and update imports so Vite builds the SCSS asset through the normal renderer entrypoint
- update renderer package metadata only as needed to reflect the SCSS-based workflow and confirm the source tree now contains direct Web Components and SCSS usage evidence
- adjust existing renderer tests if necessary so they cover the custom element bootstrap path without reducing current app logic coverage

## Risks and Assumptions

- `renderer/src/app.ts` is already large, so the migration should avoid mixing new component concerns into unrelated workout logic; if needed, extract a small bootstrap/helper module rather than expanding `main.ts`
- Vite may already support SCSS once the package dependency is present, but the package manifest and build should be verified after the stylesheet migration
- tests currently exercise `createApp` with fake DOM objects, so the custom element introduction may require a small test seam to keep unit tests deterministic outside a browser environment

## Validation Plan

- run the renderer build to confirm the SCSS asset compiles and the custom element entrypoint bundles successfully
- run renderer tests to confirm the bootstrap changes do not regress existing workout behavior
- verify the renderer source tree now contains direct evidence of `customElements.define` or `HTMLElement` usage and an `.scss` stylesheet entry

## Out of Scope

- redesigning the workout UI, copy, or navigation flow
- introducing a frontend framework or broader client-side architecture changes beyond the Web Components app-shell migration
- changing item scope or acceptance criteria beyond the stack-alignment work described in the execution item

## Handoff Notes for Implementation

- keep `renderer/src/main.ts` thin and focused on registration/bootstrap per the repository guardrails
- prefer a minimal custom element app shell as the top-level boundary; this item does not require converting every internal view fragment into separate custom elements
- preserve existing tests where they still reflect behavior, and add only the coverage needed for the new bootstrap boundary
