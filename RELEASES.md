# Release tooling and process

Releases are produced using a pinned, repository-managed semantic-release toolchain. To run locally for verification:

- Install exact dependencies and lockfile: `npm ci`
- Run a dry-run to verify resolution and release plan: `npx semantic-release --dry-run`

The GitHub Actions workflow installs the repository toolchain with `npm ci` and runs the repository-managed release script (`npm run release`) so plugin resolution does not depend on floating `npx -p` invocations.
