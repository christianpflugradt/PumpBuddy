# AGENTS.md

- Plans, backlog items and review artifacts use `make` targets as the only interface for quality and test commands (`make check`, `make check-renderer`, `make check-backend`), never tool-internal commands such as `npm test` or `cargo test`. Dependency management may use native tools (`npm install`, `cargo add`).
- Paths in tracked artifacts are repo-relative and stay within the repository.
- Pin tool and toolchain versions exactly. Do not switch a pin to a moving channel (`stable`, `latest`, floating tags) without a strong documented reason; see README.
