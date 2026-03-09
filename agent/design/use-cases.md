# Use Cases

## Purpose

This document describes the system interaction scenarios relevant for the current project state.

It is written for AI agents and human stakeholders.

The focus in this document is the temporary bootstrap use case for the first plan.

The use case is intentionally minimal and exists to verify that:

- renderer
- backend
- database
- API
- container orchestration

work together end to end.

For this bootstrap plan, technical flow details are intentionally included in the use case to validate the full system path.

---

# Current State

No user-facing product use case exists yet.

The project is still at the technical foundation stage.

---

# Target State for Current Plan

A minimal end-to-end use case exists in which the system retrieves a Hello World value from the database through the backend API and displays it in the renderer.

---

## Use Case: Display Hello World

### Goal

Verify the basic interaction between renderer, backend, database, and API.

### Trigger

The user opens the application in the browser.

### Main Flow

1. The renderer loads the application.
2. The renderer requests data from `GET /api/hello-world`.
3. The backend receives the request.
4. The backend reads the first record from the Hello World table in PostgreSQL.
5. The backend returns the value through the API response.
6. The renderer displays the returned value to the user.

### Success Condition

The user sees the Hello World value in the browser, and the value originated from the database through the backend API.

### Constraints

- the database value is read from a table rather than being hardcoded in backend logic
- the backend returns the value through the API
- the renderer displays the value received from the API
- authentication is not part of this plan use case

### Out of Scope for This Plan

- workout execution
- plan management
- authentication
- authorization
- persistent user-specific behaviour
- domain-specific fitness logic

---

# Change Notes

- 2026-03-09: Initial bootstrap use case defined for plan 1.
