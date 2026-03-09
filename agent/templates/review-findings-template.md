# Review Findings Template

Use this structure when `review-item` returns an item to `open`.

Repeat one block per failed acceptance criterion or blocking issue.

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
