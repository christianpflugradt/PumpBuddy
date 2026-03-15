# Plan: Create auth persistence schema

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Create backend migration files that add the auth persistence schema for users, access-key secrets, and sessions with the required relationships and constraints for the auth MVP.

## Implementation Approach

- inspect the existing backend migration pattern and naming convention, then add a new migration for `users`, `user_secrets`, and `sessions`
- define required columns and constraints from the item and auth concept: primary keys, required timestamps, nullable fields, foreign keys, and support for one-to-many user→secrets and user→sessions history
- store only encoded/hash string fields for `secret_hash` and `session_token_hash`; avoid any cleartext secret/token columns
- ensure schema choices keep future multi-user expansion viable (`login_name` present, secret/session history preserved)

## Risks and Assumptions

- assumes the project already has UUID/timestamp support available in migrations; if not, migration must align with existing DB extension/bootstrap pattern
- auth concept includes optional metadata fields; this item should prioritize required fields and constraints without expanding scope
- migration order must avoid FK creation failures by creating referenced tables before dependent tables

## Validation Plan

- run the project’s executable migration verification step documented by the item (for example `cargo test --manifest-path backend/Cargo.toml`)
- confirm migration applies successfully on a clean database and defines all three tables with expected foreign keys and nullability

## Out of Scope

- implementing auth endpoints or cookie/session runtime behavior
- adding access-key rotation tooling or session cleanup jobs
- changing non-auth domain behavior beyond schema support needs

## Handoff Notes for Implementation

- keep this plan implementation-oriented and scoped to schema/migrations only
- preserve acceptance criteria verbatim; do not add auth workflow requirements beyond migration work
- if existing tables later need `user_id` for ownership, handle that in separate items unless explicitly included here
