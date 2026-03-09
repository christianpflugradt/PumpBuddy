# Domain Model

## Purpose

This document defines the current conceptual model of the system.

For the current plan, the domain model is intentionally temporary and minimal.

It exists only to support the first end-to-end technical slice of the application.

---

# Current State

No stable product domain model exists yet.

The project is still establishing the first technical plan.

---

# Target State for Current Plan

A temporary bootstrap domain exists for retrieving and displaying a Hello World value from the database through the backend API.

This temporary model may be replaced in later plans.

---

## Temporary Domain Concept: Hello World Record

### Description

A temporary record stored in the database and used to verify that the application stack works end to end.

### Attributes

- `value`: string

### Relationships

- Conceptually mapped to the API response field `HelloWorldResponse.value`.

### Notes

- the exact table name is not semantically important for the project
- the exact column names are not semantically important for the project
- this concept is purely a bootstrap concept and not part of the intended long-term product domain

---

## Domain Constraints for This Plan

- at least one Hello World record must exist in the database
- a Hello World record must provide a textual value through the domain concept

---

## Out of Scope for This Plan

The following domain concepts do not exist yet in the active model:

- user
- token
- workout plan
- workout session
- exercise
- set
- progress history

These concepts may be introduced in later plans.

---

# Change Notes

- 2026-03-09: Initial temporary bootstrap domain model defined for plan 1.
