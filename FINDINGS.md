# Extended Review Findings

Review Task: review-consistency

Summary:

- 2 findings identified
- overall readiness: follow-up work recommended before acceptance

<!-- FINDING -->
# Renderer CI: TypeScript errors in `src/pumpbuddy-app.ts`
Priority: P1

## Summary

The renderer CI job is failing due to TypeScript errors in `renderer/src/pumpbuddy-app.ts`. This directly blocks the renderer TypeScript check used by CI and prevents the plan from being fully accepted.

## Evidence

- `agent/execution/open-item-09.md` describes the two TS errors and is currently an open execution item.
- `agent/tmp/finalize-plan-findings.md` contains the same diagnosis and suggested approaches.
- `renderer/src/pumpbuddy-app.ts` shows a private field initialized to `null` and an `addEventListener` call for the custom event `pb-unauthorized` where a `null` listener or untyped event name causes compiler errors.

## Goal

Fix the TypeScript compilation errors in `renderer/src/pumpbuddy-app.ts` so the renderer TypeScript check completes without errors and the renderer CI job can pass.

## Scope

- Limit changes to `renderer/src/pumpbuddy-app.ts` and any adjacent type declarations required to resolve the errors (for example small typings for the custom event or the private field type).
- Avoid functional or UX changes beyond the type fixes described.

## Acceptance Criteria

- `npx tsc --noEmit` in the renderer project completes without errors (or the primary CI TypeScript check used by the project passes).
- The specific errors are resolved: the field that was typed `null` accepts the assigned function (or the assignment is updated), and the `addEventListener` invocation uses a compatible event name and non-null listener so the compiler accepts it.
- The renderer CI job (or equivalent local reproduction) exits with code 0.

## References

- `agent/execution/open-item-09.md`
- `agent/tmp/finalize-plan-findings.md`
- `renderer/src/pumpbuddy-app.ts`
<!-- END FINDING -->

<!-- FINDING -->
# Broken README coverage badge endpoints
Priority: P2

## Summary

The README references coverage badge endpoints hosted on GitHub Pages (under `christianpflugradt.github.io/PumpBuddy`) that currently return HTTP 404 and render Shields badges with `resource not found`. This causes broken badges in the repository README and misrepresents CI/coverage status.

## Evidence

- `agent/tmp/review-item-findings.md` documents runtime checks that show the badge JSON endpoints return 404 and the Shields badges render as error-state images.
- `README.md` contains badge links pointing to `https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json` and `.../renderer-coverage.json` that currently do not resolve.

## Goal

Restore or replace the coverage badge endpoints so README badges resolve correctly, or update README to remove/replace the broken badges with a working approach.

## Scope

- Either fix the publication of the `badges/*.json` endpoints on GitHub Pages (or the chosen hosting), or update `README.md` to reference working badge endpoints (for example direct Shields links to CI artifacts) or remove the badges.
- Keep the change narrowly focused to documentation and badge publication; do not change the coverage reporting tooling beyond what's needed to publish badge data.

## Acceptance Criteria

- The badge URLs referenced by `README.md` return a valid badge image (not Shields `resource not found`) when fetched.
- The README displays coverage badges that accurately reflect the latest published coverage data.

## References

- `README.md`
- `agent/tmp/review-item-findings.md`
<!-- END FINDING -->

---

Next steps: please review these findings and indicate whether you want backlog items created for `all`, `only-p0`, `only-p1`, `only-p2`, `only-p3`, or `through-pX` (for example `through-p2`). If you approve backlog creation, I will run:

```sh
agent/scripts/create-review-backlog.sh FINDINGS.md <mode>
```

When backlog items are created I'll remove `FINDINGS.md` before committing so the normal plan-item flow can continue.
