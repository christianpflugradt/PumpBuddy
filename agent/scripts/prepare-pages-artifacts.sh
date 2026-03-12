#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
site_root="${1:-$repo_root/site}"

rm -rf "$site_root"
mkdir -p "$site_root/badges"
touch "$site_root/.nojekyll"

export COVERAGE_BADGE_OUTPUT_DIR="$site_root/badges"

"$repo_root/agent/scripts/check-backend-coverage.sh"
(
  cd "$repo_root/renderer"
  npm run coverage:check
)

cat >"$site_root/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>PumpBuddy Coverage Badges</title>
  </head>
  <body>
    <p>Coverage badge endpoint artifacts for Shields.</p>
  </body>
</html>
EOF
