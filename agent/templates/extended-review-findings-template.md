# Extended Review Findings Template

Use this structure for plan-state review tasks:

- `review-consistency`
- `review-architecture`
- `review-technology`
- `review-quality`
- `review-security`

Write the review output to the repository root as `FINDINGS.md`.
Create one finding block per issue. If no meaningful findings are discovered, keep `FINDINGS.md` and state that explicitly in the summary section instead of inventing low-value follow-up work.

Each finding block must:

- include exactly one `Priority: P0`, `Priority: P1`, `Priority: P2`, or `Priority: P3` line
- stay focused on one distinct finding
- explain the problem and provide concrete evidence
- include execution-item-ready `## Goal`, `## Scope`, `## Acceptance Criteria`, and `## References` sections so approved findings can be converted into backlog items without rewriting
- be wrapped in `<!-- FINDING -->` and `<!-- END FINDING -->`

After drafting `FINDINGS.md`, ask the stakeholder to review it and choose one of these backlog-creation modes:

- `all`
- `only-p0`, `only-p1`, `only-p2`, or `only-p3`
- `through-p0`, `through-p1`, `through-p2`, or `through-p3`

If the stakeholder approves backlog creation, run:

```bash
agent/scripts/create-review-backlog.sh FINDINGS.md <mode>
```

When backlog items are created, remove `FINDINGS.md` before committing and pushing so the plan can continue with the normal item workflow.

Example:

```md
# Extended Review Findings

Review Task: review-quality

Summary:

- 2 findings identified
- overall readiness: follow-up work recommended before acceptance

<!-- FINDING -->
# Missing renderer regression coverage for resume flow
Priority: P1

## Summary

The resume workflow changed materially, but the renderer test suite does not exercise the resumed-session path end to end.

## Evidence

- `renderer/src/app.ts` contains resume-state branching
- `renderer/src/app.test.ts` does not cover the resumed-session branch

## Goal

Add automated coverage for the resume workflow so regressions in resumed session behavior are detected.

## Scope

- add or update renderer tests for the resumed-session path
- keep the item focused on verification; do not redesign the workflow itself unless a test exposes a concrete defect

## Acceptance Criteria

- renderer tests cover the resumed-session branch with at least one automated test
- `npm test -- --runInBand` in `renderer/` passes

## References

- `renderer/src/app.ts`
- `renderer/src/app.test.ts`
<!-- END FINDING -->
```
