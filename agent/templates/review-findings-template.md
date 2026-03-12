# Review Findings Template

Use this structure when `review-item` returns an item to `open`.

Repeat one block per failed acceptance criterion or blocking issue.

If a required validation could not be completed because of missing permissions, sandbox limits, denied access, unavailable services, missing credentials, or similar environment blockers, record that as a failed criterion here instead of accepting the item.

```md
### Criterion

[Name of acceptance criterion or violated constraint]

- Status: fail
- Evidence: [Concrete evidence from code/tests/behavior]
- Risk: [Why this blocks acceptance and potential impact]
```

Optional for non-blocking context:

```md
### Additional Notes

- [Short optional note]
```
