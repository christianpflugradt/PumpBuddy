# Plan: Add renderer login-first app boot flow

## Item Reference

- `agent/execution/open-item-07.md`

## Goal Summary

Require a session check at renderer startup and show an Access Key login view before protected content, transitioning into the authenticated app flow after session or login success.

## Implementation Approach

- Locate renderer boot sequence in `renderer/src/pumpbuddy-app.ts` and identify where protected UI is mounted.
- Add a startup auth gate that calls `GET /auth/session` and routes to either login view or authenticated app flow.
- Build an Access Key-only login view/component, wire submit to `POST /auth/login`, and on success transition to authenticated flow without reload.
- Keep auth copy in English and avoid adding heavy dependencies or large entrypoint logic.

## Risks and Assumptions

- Assumes auth endpoints and contract are defined in `AUTH_CONCEPT.md` and OpenAPI YAML; renderer client calls must match those contracts.
- Entry-point growth risk: keep orchestration thin and move UI/view logic into dedicated components if it expands.

## Validation Plan

- Run `npm --prefix renderer test --` or the closest existing renderer test command.
- Manually verify: cold start shows login, valid access key transitions to app without reload, and existing valid session skips login.

## Out of Scope

- Changes to backend auth logic or session storage.
- Non-English copy or expanded login methods beyond Access Key.

## Handoff Notes for Implementation

- Prefer reusing existing renderer API client patterns for HTTP calls.
- Keep login view modular to preserve entrypoint thinness.
