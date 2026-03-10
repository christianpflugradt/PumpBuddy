#!/usr/bin/env sh
set -eu

if [ "$#" -ne 0 ]; then
  echo "Usage: agent/scripts/finalize-discuss-plan.sh" >&2
  exit 2
fi

DISCUSS_DOCS="
agent/strategy/plan.md
agent/strategy/tech-stack.md
agent/strategy/engineering-guardrails.md
agent/strategy/test-strategy.md
agent/strategy/security-baseline.md
agent/strategy/security.md
agent/strategy/capabilities.md
agent/design/use-cases.md
agent/design/domain-model.md
README.md
AGENTS.md
"

set --
for path in ${DISCUSS_DOCS}; do
  if [ -f "${path}" ]; then
    set -- "$@" "${path}"
  fi
done

if [ "$#" -eq 0 ]; then
  echo "No discussion documents available for finalization." >&2
  exit 3
fi

if [ -z "$(git status --porcelain -- "$@")" ]; then
  echo "No discussion document changes detected." >&2
  exit 4
fi

git add -- "$@"

if git diff --cached --quiet; then
  echo "No staged discussion document changes after git add." >&2
  exit 5
fi

PLAN_ID="$(awk '
  /^## Plan ID$/ { in_id=1; next }
  in_id == 1 && NF > 0 { print; exit }
' "agent/strategy/plan.md" 2>/dev/null || true)"

case "${PLAN_ID}" in
  pb-[0-9]*)
    git commit -m "docs: finalize discuss plan ${PLAN_ID}"
    ;;
  *)
    git commit -m "docs: finalize discuss plan updates"
    ;;
esac
git push

echo "DISCUSS_PLAN_FINALIZED=1"
