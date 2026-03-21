# AGENTS.md

This repository has two modes: `task` and `free`.

## Task Mode

If a prompt starts with `Task:`, `task:`, `T:`, or `t:` (case-insensitive), the first action must be:

```bash
agent/scripts/tasks.sh <task-name|alias|number>
```

Rules:
- Do not inspect the repository before running the script.
- Do not substitute another command.
- Do not infer the task yourself.
- Treat script output as the authoritative instruction set.
- Continue only after successful script execution.
- Start each task run with fresh context.
- Do not carry implicit perspective between task runs.
- When changing perspective (for example implement -> review), use fresh context.

If the script fails, stop deterministic task execution and follow repository failure-handling guidance if present.

## Free Mode

If the prompt does not start with `Task:`, `task:`, `T:`, or `t:`, operate in free mode.

Rules:
- Interpret the request normally.
- Use repository context only when needed.
- Do not run `agent/scripts/tasks.sh` unless explicitly requested.

## General

Do not mix task mode and free mode implicitly.
