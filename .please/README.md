# Repository governance

The independently installed published CLI in `.please-version` governs this
repository. Candidate binaries never govern their own validation. The three baseline Rule Sets
and the independent Gemini Flash-Lite provider use revision
`c4d4c60eff8fc5d32641f5fe33b5cfa9e337e1f3`, shared with Passing By, Please Behave
CLI and Action. Local Rules contain PumpBuddy requirements only.

## Preparation and hooks

Run `mise trust` and `mise install` to prepare the project versions of Node,
Python, ShellCheck, actionlint and Gitleaks. Mise reads `.node-version`; it does
not manage Rust or machine-level packages. Use the host's stable Rust compiler
with rustfmt and Clippy. The `stable` channel in `backend/rust-toolchain.toml`
also selects the CI compiler; local checks reject prerelease compilers without
requiring an exact numeric version. LLVM tools are used by optional coverage.
Git, Bash, make, a native compiler/linker and Docker with an accessible daemon
remain host prerequisites. The Argon2 CLI is needed for explicit development
access-key seeding. Host installations on Nix-managed machines remain under the
user's control; ask the user for any required Nix adjustment. Repository setup
does not invoke Homebrew or install global tools. Checks never install tools.

The backend Docker compiler version and digest stay pinned for reproducible
container builds. They need not equal the host's numeric stable version. A local
compiler override is reserved for a documented project compatibility requirement.

Run `mise run prepare` (which delegates to `make prepare`) explicitly to install
locked npm dependencies, prepare the
repository-local Python environment, fetch Cargo dependencies, cache the OpenAPI
generator and PostgreSQL test image, generate models and prepare browsers.
This downloads dependencies but does not install machine-wide tools. CI prepares
Chromium, Firefox and WebKit; local preparation uses Chromium. Repeat preparation
when dependency locks, toolchain pins or generator pins change.

Use `mise exec -- make install-git-hooks` for hook setup and `mise exec -- make check`
for manual validation without shell activation. Run Git as
`mise exec -- git commit` and `mise exec -- git push` so hooks inherit the same
configured tools. Plain commands require mise shell activation or equivalent
PATH setup; `mise install` alone does not activate tools. The separately installed
published governor must remain on PATH, and credentials are supplied externally.

Run `make install-git-hooks` with the published governor on PATH. It verifies the
version, retires the old `.githooks` configuration only after old hooks are removed,
then synchronizes external sources and managed Git wrappers. Custom hooks are
preserved and require explicit integration. Normal execution uses immutable
cached imports. Reports under `.please/reports/` remain ignored.

When using a repository-local governor, prepend `.tools/please/bin` to PATH in
the shell that invokes Git. Managed wrappers resolve `please` from that PATH;
the global installation is not replaced by this repository.

Git hooks are the final local validation gates. Do not manually repeat the full
gate before Git operations. Targeted Makefile diagnosis and explicit formatting
are permitted. Inspect failures with `please status --details`, fix their cause
and retry Git. Never bypass hooks.

## Local Rules

| Rule | Execution points |
| --- | --- |
| format | pre-commit, pre-push, check |
| framework | pre-commit, pre-push, check |
| api-models | pre-push, check, release-candidate |
| backend-quality | pre-push, check |
| renderer-quality | pre-push, check |
| api-contract-alignment | pre-push, check |
| bootstrap-secret-handoff | pre-push, check |
| release-artifacts | pre-push, check, release-candidate |
| release-rules, workflows | pre-push, check |
| npm-audit | check |
| release-package, release-package-verify | release-candidate |

Backend runs Clippy for all targets/features and the complete native suite,
including Testcontainers PostgreSQL integration tests. Renderer retains its
complete native check: editor-input architecture, TypeScript, unit coverage,
instrumented build, browser smoke and merged coverage. Tests are not split into
artificial categories.

Framework retains Pydantic project/example contracts, cross-file consistency,
execution item invariants, command policy, ShellCheck, the disposable
workspace-cleanliness self-test and all 13 task contracts. Missing ShellCheck
now fails instead of silently skipping lint.

API generation is a prerequisite of backend, renderer and Docker builds.
Generation and those checks share the `build` resource because they use common
generated/build outputs. Packaging depends on successful candidate checks;
archive verification depends on packaging. Targeted backend/renderer Makefile
checks expect dependencies and generated models prepared beforehand.

Cargo tests and Clippy select locked offline mode. npm fallback execution is
offline. PostgreSQL runs locally with synthetic credentials; browser APIs are
mocked. Preparation caches test dependencies. Docker release builds may download
build dependencies; npm audits intentionally access current advisories.
Rust dependency auditing is manual: `make check-rust-audit` requires cargo-audit
0.22.2 and accesses current advisories. It does not block CI or releases.
Release helper tests also build a tiny scratch image without network access and
verify its Docker save/load identity. Tests never call a real model or paid service.

## Shared rules

External security and repository conventions run at check and pre-push.
Check reads the worktree; pre-push reads HEAD. Readiness explicitly selects HEAD
for security/license checks and requires successful push CI for the exact source
SHA, trusted repository, main branch, workflow and `Check` job. Retained successful
jobs from partial reruns within the same CI run are accepted.

The production template is `runtime/compose/.env.example`, which developers copy
to ignored `.env.prod`. The renderer keeps its production version default (`dev`)
in Vite configuration; Docker's VITE_APP_VERSION still overrides it.
No environment filename exceptions are added to shared security rules.

The license check matches the external PolyForm Noncommercial 1.0.0 reference
byte-for-byte. Existing copyright attribution is preserved in `NOTICE`.

Commit-msg uses only the external Conventional Commits Check and advisory
header-only wording Review. `commit-scopes.txt` supplies project scopes.
No local header constraints, commit-range or PR-title checks remain.
The independent provider package supplies the adapter. Export GEMINI_API_KEY
in the process invoking Git; unavailable credentials and Review FAIL/ERROR remain
visible without blocking commits. No adapter or credentials are copied here.

## CI and badges

CI has `check` / `Check`, runs on main pushes and pull requests including
Renovate, and executes deterministic Please Behave checks. Framework checks
are part of that job. Ordinary dependency merge policy remains unchanged; the governor follows the shared update policy below.
CI, Release Readiness and Release Candidate execute through SHA-pinned Please
Behave Action v1.2.0 with `checks-only: 'true'` and `summary: 'true'`. The CLI
version remains pinned in `.please-version`. Install-only mode precedes explicit
synchronization; the execution invocation produces the Job Summary.

Coverage Badges is independent. It calculates backend coverage and complete
renderer coverage again, then publishes the same two GitHub Pages endpoints.
Only this workflow writes badge files. Backend coverage keeps its informational
n/a fallback, stable-toolchain line-coverage fallback and default zero threshold.
Renderer coverage thresholds remain unchanged. The Pages job retains
`coverage-pages`, `cancel-in-progress: false` and `queue: max`; ordering follows
queue arrival. Only the Pages job receives Pages/OIDC write permissions.

Actionlint 1.7.12 predates GitHub's supported concurrency.queue property.
The workflow checker validates queue values and the max/cancellation combination,
then suppresses only actionlint's unknown-queue diagnostic. All other workflow,
expression and shell diagnostics remain blocking.

## Release

Manual `release.yml` remains the target of accepted finalize-plan automation.
Jobs are Plan, Release Readiness, Release Candidate and Publish. Readiness and
Candidate depend only on Plan and run in parallel. Publish requires both
successfully. Nothing publishes when Plan finds no releasable changes.

Plan performs a Semantic Release dry run bound to the dispatched SHA.
The stable 4.x series is retained: feat is minor; fix, perf, chore, refactor,
build and effective revert are patch; ci, config, docs, style and test do not
release unless breaking. Breaking changes are major. Historical build(release)
version commits are ignored. Scoped reverts cancel unreleased originals in
version calculation and notes. No generated version commit is created.

Candidate builds the versioned Docker images. Source checks, framework checks and backend/renderer tests are reused from CI. Candidate images explicitly remain linux/amd64.
Local Docker checks retain the native host platform used before this migration;
Linux CI and Release Candidate build AMD64 natively. Local ARM checks do not
introduce an ARM release image or require AMD64 compiler emulation.
Backend APP_VERSION, BUILD_COMMIT and BUILD_TIMESTAMP and renderer APP_VERSION
are retained; both runtime images also record source/version labels.
Caddy configuration is still validated by the renderer build.

Only Candidate builds release images. It exports Docker archives and records
archive SHA-256, image configuration digests, version, source SHA and workflow
run/attempt. Candidate and Publish verify the exact file/image set, safe archive
paths, configuration digests, platform and source/version labels. Publish loads
archives and binds Docker's loaded identity to the archived configuration. This
supports both classic config IDs and containerd OCI manifest IDs. Publish tags
and pushes those verified loaded IDs; registry manifests must reference the same
configuration digests. Publish never builds; the published governor verifies common release evidence.

Archives remain internal workflow artifacts retained for seven days. Existing
GitHub release notes, version tag and GitHub plugin comments/labels are preserved.
GHCR names remain `ghcr.io/christianpflugradt/pumpbuddy-{backend,renderer}`
with the exact `v<version>` tag; no latest tag or architecture is added.
Production Compose continues consuming those names and tags.

Only current-run/current-attempt candidates can publish. Partial Release reruns
without current-attempt candidates fail and require rerunning all jobs.
Before tagging, Semantic Release rechecks planned version, dispatched source and
remote main. Main is checked again before image pushes. Serialization prevents
competing Release runs, but cannot atomically lock main pushes, two registry
uploads and GitHub publication. Service failures may leave partial publication
and must be reported rather than treated as success.

Only Plan and Publish request repository writes. Publish additionally retains
package, issue and pull-request writes for existing GHCR/GitHub plugin behavior.
Readiness has actions:read for CI evidence. GITHUB_TOKEN supplies permissions;
no new repository secret is required. GEMINI_API_KEY is used only by the normal
local advisory commit hook, not offline tests or Release.

## Shared release evidence

The separate external `rulesets/multi-point/releasable-open-source-software` Rule Set shares the reviewed
immutable revision with the other imports. Its `release-contract` Check uses
`release-ci.json` and `release-artifacts.json`. Readiness trusts exact-source CI
without an age limit or repeated source/security checks. Candidate builds and
artifact-specific tests remain local. After they pass, `release-record` writes
internal `release-evidence/TARGET.json` manifests. Publish collects every expected
target and invokes `release-verify` before publication. The shared Check verifies
repository, workflow, source, version, current run/attempt and artifact hashes.
Missing or altered evidence blocks publication; partial release reruns require
rerunning all jobs. Evidence is transferred separately and is not a public asset.

Before tagging, thin local Semantic Release adapters load the cached external
publication guard exported by `release-verify`. The shared implementation checks
the recalculated version, checkout, dispatched SHA, repository, main branch and
current remote main. Custom prerelease/image publication reuses that source guard.
Offline lifecycle fixtures exercise the actual pinned external module from cache.

## Published governor updates

`.please-version` records the exact latest stable published governor. The shared
`renovate-governor` preset in the external ruleset repository tracks GitHub
Releases and auto-merges newer stable versions, including major updates, after
checks pass. Governor updates have no dependency cooldown; ordinary dependency
policies remain unchanged. CI installs the proposed pin before running checks.
Renovate runs determine update timing. Local governor preparation uses the same
pin; candidate binaries never become the governor.
