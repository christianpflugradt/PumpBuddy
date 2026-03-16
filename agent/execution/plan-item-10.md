# Plan: Pin Semantic-Release Toolchain

Goal

Make release automation deterministic by defining `semantic-release` and required plugins as pinned repository-managed dependencies with lockfile control.

Implementation steps (order matters)

1. Create a root Node package manifest at `package.json` that declares `semantic-release` and the required plugins as `devDependencies` with explicit versions. Example packages to include:
   - `semantic-release`
   - `@semantic-release/commit-analyzer`
   - `@semantic-release/release-notes-generator`
   - `@semantic-release/github`

2. Generate lockfile metadata for the chosen package manager (preferred: npm `package-lock.json`) by running `npm install --package-lock-only` or a full `npm ci` in CI. Commit the resulting lockfile into version control.

3. Update `.github/workflows/release.yml` to stop using floating `npx -p` installs and instead install and run the pinned toolchain from the repository:
   - Replace steps that invoke `npx --yes -p semantic-release -p @semantic-release/...` with:
     - checkout full history (keep as-is)
     - run `npm ci` (or `npm ci --prefer-offline` in CI)
     - run `npx semantic-release` (no `-p` flags)

4. Keep existing `.releaserc.json` behavior unchanged; ensure the invocation still reads the same config file and that plugin names in `plugins` match the pinned packages.

5. Add lightweight contributor docs (single paragraph) in `RELEASES.md` or `README.md` describing how releases are produced now (pinned toolchain + `npm ci` + `npx semantic-release --dry-run` verification).

Verification

- Locally: from repository root run `npm ci` then `npx semantic-release --dry-run` and verify no unexpected resolution (dry-run produces the expected release plan without network-resolved plugin versions).
- CI: push change and run the release workflow with `workflow_dispatch`; the job should install dependencies with `npm ci` and run `npx semantic-release --dry-run` successfully.

Notes and constraints

- If the repository prefers `pnpm` or `yarn` as the package manager, adopt their lockfile and CI install commands consistently; the plan chooses `npm` when no root package manager is present.
- Do not change release semantics encoded in `.releaserc.json`; only alter how `semantic-release` is resolved and executed.
- Keep version pins conservative (explicit exact versions) to avoid floating minor/major upgrades; choose versions that match current `npx`-resolved behavior if possible.

Files to add/modify

- Add: `package.json` (root)
- Add: `package-lock.json` (generated)
- Modify: `.github/workflows/release.yml` (replace floating npx invocation)
- Optional: `RELEASES.md` or update `README.md` (document change)

Estimated work

- 1–2 hours to create root `package.json`, generate lockfile, and adjust the release workflow; additional verification time for CI runs.
