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
