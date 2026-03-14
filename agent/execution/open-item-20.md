# Fix Coverage Badges Pages Workflow Tooling

## Goal

Update the coverage badges GitHub Pages workflow so it runs on a supported Node version and has the required LLVM coverage tooling, eliminating the `llvm-cov` failure and allowing badges to publish successfully.

## Scope

- update `.github/workflows/coverage-badges-pages.yml` to use a current Node version compatible with the repo tooling
- ensure `agent/scripts/prepare-pages-artifacts.sh` can access `llvm-cov` (install `llvm-tools-preview` via `rustup` or supply `LLVM_COV` in CI)
- validate that the badge generation step produces output consumed by `README.md`

## Acceptance Criteria

- CI run of `coverage-badges-pages.yml` completes without `llvm-cov` errors
- badge artifacts are generated and the README badges render correctly on GitHub
- `agent/scripts/prepare-pages-artifacts.sh` succeeds in CI without manual intervention

## References

- `agent/strategy/plan.md`
- `.github/workflows/coverage-badges-pages.yml`
- `agent/scripts/prepare-pages-artifacts.sh`
- `README.md`


## Review Findings

### Criterion

CI run of `coverage-badges-pages.yml` completes without `llvm-cov` errors

- Status: fail
- Evidence: The workflow still fails in CI with `rustup which llvm-cov` reporting `error: not a file: '/home/runner/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/llvm-cov'` followed by `backend coverage requires llvm-cov`. This shows llvm-cov is still unavailable in the job.
- Risk: Coverage badge publication remains blocked, so Pages artifacts and badge updates cannot succeed.

### Criterion

`agent/scripts/prepare-pages-artifacts.sh` succeeds in CI without manual intervention

- Status: fail
- Evidence: The CI log shows the workflow exits with `Error: Process completed with exit code 1` after `agent/scripts/prepare-pages-artifacts.sh` runs, due to missing llvm-cov.
- Risk: The Pages artifact step cannot complete, so the workflow cannot publish badges.

### Criterion

badge artifacts are generated and the README badges render correctly on GitHub

- Status: fail
- Evidence: The badge generation step does not complete because the workflow exits early with missing llvm-cov, so artifacts are not produced for Pages publication.
- Risk: README badges remain stale or broken until the workflow can generate and publish the badge endpoints.
