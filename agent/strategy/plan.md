# Plan: Static Workout Wizard in Renderer

## Plan ID

pb-003

## Goal

Replace the current renderer Hello World page with a minimal static workout flow that demonstrates the future workout guidance UX (start workout, step through exercises, complete plan) without backend integration.

## Scope

- Replace the renderer Hello World UI with a start screen containing a single hardcoded action in English (`Start Workout`, `Push Day`).
- Implement a client-side wizard flow (no full page refresh) for one hardcoded workout plan with five realistic English exercise names and distinct prefilled weight suggestions.
- Show one exercise at a time with numeric-only weight input and adjacent decrement/increment controls.
- Provide both forward and backward navigation between exercises to allow correction of previous entries.
- Provide a completion state after the final exercise (for example `Plan Completed`).
- Keep all workout data static in the renderer for this plan.
- Remove the renderer dependency on the Hello World display flow while allowing backend/API Hello World implementation to remain in place.

## Out of Scope

- backend workout endpoints
- database reads or writes for workout data
- API integration for workout progression
- persistence of in-progress workout state
- automatic loading/resume of in-progress workout
- algorithmic weight recommendation calculation
- multi-set and reps tracking
- plan selection with multiple plans
- visual styling/polish beyond minimal functional UI

## Success Criteria

- Opening the app shows a workout start screen in English with a single hardcoded plan action (`Push Day`).
- Starting the workout enters a dynamic wizard view without full page reload between exercise steps.
- The wizard contains exactly five realistic exercises in English and each exercise has a distinct default numeric weight value.
- Weight input accepts numeric values only and can be adjusted using explicit decrement/increment controls next to the input.
- Users can navigate both forward and backward across exercise steps while staying in the same app flow.
- Completing the final step shows a static completion view (`Plan Completed` or equivalent).
- The renderer no longer presents the previous Hello World page.

## Constraints

- Follow the existing frontend stack and architecture (TypeScript, Web Components, Vite, SCSS as applicable).
- Keep implementation minimal and static to preserve scope boundaries of this plan.
- Do not introduce backend/database/API coupling for workout flow in this plan.
- Keep user-facing copy in English for this flow.
- Design the renderer flow so future incremental sync/resume behavior can be layered in later plans without requiring full-page form submission patterns.

## Inputs

- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- existing renderer Hello World implementation (to be replaced in renderer scope only)

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
