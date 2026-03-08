# AGENTS.md

This repository supports two operating modes: task mode and free mode.

The purpose of this file is to keep agent startup deterministic while staying lightweight.

## Task Mode

If the user prompt starts with:

`Task: <task-name>`

then your first action must be to execute:

```bash
scripts/tasks.sh <task-name>
```

Task mode rules:

- Do not inspect the repository before running the script.
- Do not substitute another command.
- Do not infer the task yourself.
- Treat the script's standard output as the authoritative task instruction set.
- Base all further task decisions on that output.
- Only continue after the script has executed successfully.
- Start each task execution with a fresh context.
- Do not carry implicit perspective from a previous task run.
- When switching task perspective (for example implementation to review), a fresh context is mandatory.

If the script does not complete successfully, stop deterministic task execution and follow the dedicated failure-handling guidance if one is provided by the repository.

## Free Mode

If the user prompt does not start with `Task:`, operate in free conversation mode.

Free mode rules:

- Interpret the user's request normally.
- Use repository context only when needed.
- Do not automatically execute `scripts/tasks.sh` unless explicitly requested.

## General Rule

Do not implicitly mix task mode and free mode.

If a prompt starts with `Task:`, task mode governs the interaction.
