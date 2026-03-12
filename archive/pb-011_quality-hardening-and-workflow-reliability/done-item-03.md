# Enforce Local Pre-Push Quality Gate

## Goal

Provide a repository-managed pre-push workflow that reliably runs the local quality gate before pushes proceed.

## Scope

- add the repository automation needed to install or maintain a pre-push hook that invokes the supported local quality command
- ensure the hook blocks pushes when quality checks or required artifact-freshness checks fail
- document the minimal developer setup needed to enable the managed pre-push hook locally

## Acceptance Criteria

- a repository-managed pre-push hook path exists and runs the project quality gate before allowing `git push` to continue
- the documented setup command installs or enables the hook without manual file copying
- with the hook enabled, a forced failure inside the quality command causes the pre-push hook to exit non-zero
- `agent/scripts/run-quality.sh check` remains the single quality entrypoint invoked by the hook

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/scripts/run-quality.sh`
- `.github/workflows/ci-quality.yml`

## Dependencies

- `item-02`

## Out of Scope

- server-side Git hooks or hosted workflow retry automation


## Review Acceptance

- Criteria Met: All acceptance criteria are satisfied. The repository now contains a tracked `.githooks/pre-push` hook, a managed installer/status command via `agent/scripts/install-git-hooks.sh` exposed through `make install-git-hooks` and `make git-hooks-status`, documentation for one-step local setup in `README.md`, and the hook delegates only to `agent/scripts/run-quality.sh check`.
- Evidence: In commit `c1bc72d` (`feat: enforce pre-push quality gate locally`), `.githooks/pre-push` resolves the repo root and invokes `"$repo_root/agent/scripts/run-quality.sh" check` directly, `agent/scripts/install-git-hooks.sh install` configures `git config --local core.hooksPath .githooks` without manual copying, and `README.md` documents the enablement and status commands plus the shared prerequisites.
- Runtime/Build Check: In a temporary clone created from the committed state, `make install-git-hooks && git config --local --get core.hooksPath && python3 - <<'PY' ... forced failure ... PY && git push review HEAD:refs/heads/review-test` produced `.githooks` for `core.hooksPath` and the push exited with status `1`, printing `forced quality failure` before Git contacted the bare test remote.
- Residual Risk: none identified
