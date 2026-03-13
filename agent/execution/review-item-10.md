# Backend application layer depends on API transport errors

## Summary

The backend application layer currently depends directly on API transport concerns, which reverses the intended dependency direction between transport and business validation.

## Evidence

- [backend/src/application/workouts.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/application/workouts.rs#L1) imports `crate::api::{map_persistence_error, ApiError}` directly.
- [backend/src/application/workouts.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/application/workouts.rs#L7) and [backend/src/application/workouts.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/application/workouts.rs#L29) return `Result<(), ApiError>` from application-level validation functions.
- [backend/src/api/handlers.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/api/handlers.rs#L144) through [backend/src/api/handlers.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/api/handlers.rs#L237) call those functions from the transport layer, so the application module is no longer reusable without the HTTP error contract.

## Goal

Restore one-way dependency flow so application-layer workout validation exposes domain- or application-level results and the API layer performs HTTP-specific error mapping.

## Scope

- introduce an application-local error or validation result type that does not depend on `api::ApiError`
- move persistence-to-HTTP error translation fully into the API boundary
- update handler wiring to translate application outcomes into transport responses without changing current behavior

## Acceptance Criteria

- no file under `backend/src/application/` imports symbols from `backend/src/api/`
- application-layer validation functions return application/domain errors rather than `ApiError`
- API handlers remain the only layer responsible for converting failures into HTTP-facing status codes and messages

## References

- `backend/src/application/workouts.rs`
- `backend/src/api/handlers.rs`
- `backend/src/api/error.rs`
- `agent/strategy/engineering-guardrails.md`
