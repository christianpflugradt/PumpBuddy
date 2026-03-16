# Docker build fails during `npm ci` in Dockerfile

## Goal

Make the Docker image build succeed by resolving the `npm ci` failure caused by a missing package version.

## Scope

- Investigate why `@vitest/coverage-c8@^0.1.0` cannot be found (dependency tree, lockfile, registry resolution).
- If the package requirement is invalid, update `package.json` and/or `package-lock.json` to a valid version or remove the offending dependency.
- If the package is required, pin a published compatible version or adjust registries/installation so `npm ci` succeeds in the Docker build environment.
- Keep changes limited to dependency declarations, lockfile regeneration, or Dockerfile adjustments required to make `npm ci` succeed.

## Acceptance Criteria

- Running the repository Docker build completes without error: `docker build .` exits with code 0 and the build logs show successful `npm ci` in the stage that previously failed.
- Alternatively, running `npm ci --no-audit --no-fund` in the same build context (same Node/npm version) succeeds without the `ETARGET` error.

Verification commands:

```
docker build --progress=plain .
# or reproduce the failing step locally inside a matching Node container:
docker run --rm -v "$PWD":/app -w /app node:18-bullseye bash -lc "npm ci --no-audit --no-fund"
```

## References

- `agent/strategy/plan.md`
- `Dockerfile`
- `package.json`
- `package-lock.json`

## Notes for Review

- Observed failure (excerpt):

```
npm ERR! code ETARGET
npm ERR! notarget No matching version found for @vitest/coverage-c8@^0.1.0.
...
target renderer: failed to solve: process "/bin/sh -c npm ci --no-audit --no-fund" did not complete successfully: exit code: 1
```

- The failure occurs at `RUN npm ci --no-audit --no-fund` in `Dockerfile` (line ~7 in reported output).
- Keep the plan active; do not archive. This item will guide the next implementation work to unblock finalization.
