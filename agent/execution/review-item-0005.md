# Publish coverage badges and quality usage docs

## Goal

Expose backend and renderer coverage status in the README together with concise documentation of the quality workflow entrypoint.

## Scope

- add backend and renderer coverage badges to the README
- document the primary local quality command and any essential prerequisites needed to run it
- keep the documentation concise and consistent with the actual repository tooling

## Acceptance Criteria

- the README displays one backend coverage badge and one renderer coverage badge using the chosen badge source for this repository
- the README documents the primary local quality command from the repository root
- the documented command text matches the executable tooling added in the repository
- a reviewer can verify the documentation by following the README command and observing the expected quality flow locally

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `README.md`

## Dependencies

- `item-0001`
- `item-0003`
- `item-0004`

## Out of Scope

- changing CI coverage thresholds
- adding new tests beyond what is needed to describe the workflow
