# Review Acceptance Template

Use this structure when `review-item` accepts an item.

Only use this template when the required validation actually ran successfully in an environment with the needed permissions and dependencies. If a required check was blocked by sandboxing, denied access, missing credentials, unavailable services, or similar environment limits, do not accept the item; return it to `open` with review findings instead.

```md
- Criteria Met: [Summarize which acceptance criteria are satisfied]
- Evidence: [Short concrete evidence from code/tests/behavior]
- Runtime/Build Check: [Executed command + observed result]
- Residual Risk: [Short note on remaining risk or "none identified"]
```
