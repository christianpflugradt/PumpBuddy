# Plan: Compose Runtime Verification Commands

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Document a minimal and reproducible command sequence that verifies Compose build/startup, service status, renderer reachability, and teardown without exposing backend or database ports.

## Implementation Approach

- Update the runtime verification section in `README.md` to keep a single executable flow for startup, status check, reachability check, and teardown.
- Make renderer reachability verification resilient to startup timing by using a bounded readiness check (for example `curl` retry flags or an explicit wait loop) before declaring failure.
- Keep service-boundary expectations explicit in the docs: renderer is publicly reachable on host `:8080`, while backend and postgres stay internal-only.
- Ensure command examples are copy-paste ready for a clean checkout and remain aligned with the existing Compose topology.

## Risks and Assumptions

- Renderer startup time may vary across environments; an unbounded wait would reduce determinism, so readiness handling should stay time-bounded.
- The local environment is assumed to have Docker Engine and Docker Compose available and healthy before running verification commands.
- Reachability validation assumes the renderer serves on `http://localhost:8080` in the default local setup.

## Validation Plan

- Run the documented sequence on a clean checkout and verify `docker compose up --build -d` completes successfully.
- Run `docker compose ps` and verify only renderer publishes a host port while backend and postgres do not.
- Run the documented renderer reachability check and confirm it succeeds within the bounded readiness window.
- Run `docker compose down` and verify the stack is fully torn down.

## Out of Scope

- Changing Compose service topology, port mappings, or trust boundaries.
- Adding public exposure for backend or database services.
- Introducing new runtime automation scripts beyond documentation-level command guidance.

## Handoff Notes for Implementation

- Keep the plan lightweight by editing only documentation needed for deterministic verification.
- Preserve the current acceptance criteria wording and verify behavior through the documented commands.
- If readiness handling materially changes command shape, keep the rationale short and directly tied to reproducibility.
