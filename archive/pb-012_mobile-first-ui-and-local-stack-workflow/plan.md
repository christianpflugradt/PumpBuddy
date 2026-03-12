# Plan: Mobile-First UI and Local Stack Workflow

## Plan ID

pb-012

## Goal

Improve the day-to-day usability of PumpBuddy on a phone, make dialogs behave like true modals across the UI, streamline local stack startup and reset for development, and restore failing backend and renderer quality workflows.

## Scope

- make the workout guide mobile-first so it is comfortable to use on a phone during workouts
- extend mobile-focused UI polish to concrete app-shell areas outside the workout screen where narrow-screen usability currently suffers
- make all dialogs render as true blocking modals with correct layering, visual separation from background content, and blocked background interaction
- add Makefile targets for starting the Docker Compose stack and for fully reinitializing the local stack with rebuilt images, fresh state, and `init.sql` applied
- document the new local stack commands briefly in `README.md`
- fix the backend CI failure caused by formatting drift in `backend/src/main.rs`
- fix the renderer workflow failure caused by the test runner using an unsupported Node.js option

## Out of Scope

- redesigning the product information architecture or changing the overall application feature set
- introducing a large frontend framework or major architectural changes beyond the existing stack
- adding new workout domain behaviour unrelated to mobile usability, modal behaviour, or local developer workflow
- broad CI redesign beyond the specific backend and renderer workflow failures included in this plan

## Success Criteria

- the workout flow is comfortable to use on common phone-sized viewports, with primary actions and content remaining reachable and readable without desktop assumptions
- start-screen and app-shell layouts that participate in the workout experience behave cleanly on narrow screens without obvious clipping, overlap, or awkward scrolling
- all dialogs appear above the rest of the interface as true modals, visually separate background content, and prevent unintended interaction with the underlying UI while open
- `make` provides one command to start the local Docker Compose stack and one command to fully rebuild and reinitialize it from clean state, including database initialization
- `README.md` briefly explains when to use each new local stack command
- backend quality checks pass in CI without formatting-related failure
- renderer quality checks pass in CI without failure from the unsupported `--experimental-strip-types` option

## Constraints

- keep the implementation aligned with the existing Web Components, SCSS, Vite, Rust, Docker Compose, and GitHub Actions stack
- preserve the current trust boundary in which only the renderer is public and backend/database remain private on the internal container network
- keep user-facing product copy in English
- prefer focused UI improvements for concrete mobile pain points over a broad visual redesign
- keep the local reset workflow reproducible and explicit rather than relying on hidden manual steps

## Inputs

- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
