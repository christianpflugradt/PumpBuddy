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

Shell execution policy:
- Run ad-hoc shell commands via `zsh -lic "<command>"` so `~/.zprofile` and `~/.zshrc` are sourced and user toolchain `PATH` entries are available.

Quality/test command policy:
- Use `make` targets as the only interface for quality/test commands in plans, backlog items, and review artifacts.
- Allowed examples: `make check`, `make check-renderer`, `make check-backend`.
- Do not suggest direct `npm`, `pnpm`, `yarn`, `bun`, `vitest`, `cargo test`, or similar tool-internal commands for quality/test execution in those artifacts.
- Dependency management is separate from quality/test execution and may use tool-native commands when needed (for example `npm install` for renderer dependencies, `cargo add` for backend dependencies).
