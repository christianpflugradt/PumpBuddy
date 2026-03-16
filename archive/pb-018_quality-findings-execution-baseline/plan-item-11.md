# Plan: Run Release Workflow with Pinned Toolchain

Goal: update the GitHub release workflow to run semantic-release from repository-managed, pinned dependencies and remove floating `npx -p` package resolution.

Implementation steps (small, reversible):

- Inspect repository for existing semantic-release devDependencies and lockfile (`package.json`, `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`). If dependencies are absent, add `semantic-release` and the required plugins as devDependencies with conservative pinned versions.
- Update `.github/workflows/release.yml`:
  - Replace the single `Run semantic-release` step that uses `npx -p ... semantic-release` with two steps:
    1. `Install dependencies` — run `npm ci` (or the repo's package manager `ci` equivalent) to install pinned dependencies from the lockfile.
    2. `Run semantic-release` — run the repository-managed binary. Prefer `npm run release` with a `release` script that invokes `semantic-release` (this avoids any floating `-p` resolution). Example script: `release: "semantic-release"`.
  - Keep existing checkout, node setup, permissions, and trigger behavior unchanged.
- Ensure CI env vars/secrets expected by semantic-release (e.g., `GITHUB_TOKEN`, `NPM_TOKEN` if publishing) are preserved and passed through unchanged.
- Add a short note in the workflow or repository README indicating the workflow now relies on repository dependencies and lockfile for reproducible releases.

Verification steps:

- Locally (or in a sandbox branch): install deps with `npm ci` and run `npm run release -- --dry-run` to confirm plugin resolution and that no floating `npx -p` is used.
- In GitHub: run `gh workflow run release.yml` (or trigger a workflow dispatch) and confirm the `semantic-release` job executes using the installed dependencies and completes the dry-run or real release as expected.

Rollback / safety notes:

- If a missing plugin or version mismatch appears, revert the workflow change and add the missing dependency to `package.json` with a pinned version, commit the lockfile, and re-run.
- Do not change release plugin configuration in `.releaserc.json` as part of this task — the goal is only to change how the tool is invoked.

Files to change (implementation):

- `.github/workflows/release.yml` — modify steps as described.
- `package.json` — add `semantic-release` and required plugins to `devDependencies` only if absent.
- Commit the updated lockfile produced by `npm ci`.

(End of plan)
