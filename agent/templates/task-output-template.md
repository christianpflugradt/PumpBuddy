# Task Output Template

Use this exact structure for task responses. Do not add any other text.
Use `Context:` for the single most relevant file (plan path for plan-focused tasks, item path for item-focused tasks). Omit the line if no single context applies.
Use `Workspace:` to indicate whether there are uncommitted/unpushed changes (`CLEAN` or `DIRTY`).
If `Status:` is not `SUCCESS`, include `Reason:` on up to 3 lines describing why.

```md
Status: <SUCCESS|FAILED|BLOCKED>
Task: <task-name>
Workspace: <CLEAN|DIRTY>
Context: <path>   # optional; omit this line when no single context applies
Reason: <short line>   # optional; only when Status is not SUCCESS (max 3 lines)
```
