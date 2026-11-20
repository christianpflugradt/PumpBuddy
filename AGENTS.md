# AGENTS.md

- Specifications live in `specs/`; read `specs/README.md` first. `specs/design` describes behavior and domain, `specs/strategy` the technology, engineering, test and security rules. Consult them before changing behavior and update them in the same commit.
- Repository tooling lives in `tools/`.
- Use `make` targets as the only interface for quality and test commands (`make check`, `make check-renderer`, `make check-backend`), never tool-internal commands such as `npm test` or `cargo test`. Dependency management may use native tools (`npm install`, `cargo add`).
- Paths in tracked artifacts are repo-relative and stay within the repository.
- Pin tool and toolchain versions exactly. Do not switch a pin to a moving channel (`stable`, `latest`, floating tags) without a strong documented reason; see README.
