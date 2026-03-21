#!/usr/bin/env sh
set -eu

if [ "$#" -ne 0 ]; then
  echo "Usage: agent/scripts/task/discuss-plan/finalize.sh" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/discuss-plan.yaml"
CONTEXT_LOADER="${SCRIPT_DIR}/lib/context_loader.py"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
PLAN_FILE="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_TEMPLATE="agent/templates/telemetry-template.yaml"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

if [ ! -f "${CONTEXT_CONFIG}" ]; then
  echo "Missing context config: ${CONTEXT_CONFIG}" >&2
  exit 21
fi

if [ ! -x "${CONTEXT_LOADER}" ]; then
  echo "Missing context loader: ${CONTEXT_LOADER}" >&2
  exit 22
fi

if [ ! -f "${EXECUTION_CONFIG}" ]; then
  echo "Missing execution config: ${EXECUTION_CONFIG}" >&2
  exit 23
fi

if [ ! -f "${TELEMETRY_TEMPLATE}" ]; then
  echo "Missing telemetry template: ${TELEMETRY_TEMPLATE}" >&2
  exit 24
fi

set --
while IFS= read -r path; do
  [ -n "${path}" ] || continue
  if [ -f "${path}" ]; then
    set -- "$@" "${path}"
  fi
done <<EOF
$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_track_paths)
EOF

if [ "$#" -eq 0 ]; then
  echo "No discussion documents available for finalization." >&2
  exit 3
fi

if [ -z "$(git status --porcelain -- "$@")" ]; then
  echo "No discussion document changes detected." >&2
  exit 4
fi

COMMIT_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.commit_enabled" "true")"
PUSH_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.push_enabled" "true")"
PULL_REBASE_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.pull_rebase_before_push" "true")"
DRY_RUN_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "runtime.dry_run" "false")"

if [ "${COMMIT_ENABLED}" = "false" ] && [ "${PUSH_ENABLED}" = "true" ]; then
  echo "Invalid execution config: push_enabled=true requires commit_enabled=true." >&2
  exit 25
fi

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  echo "DRY_RUN=would_stage_paths count=$#"
  echo "DRY_RUN=would_reset_telemetry ${TELEMETRY_FILE}"
  if [ "${COMMIT_ENABLED}" = "true" ]; then
    PLAN_ID="$(extract_plan_id_yaml "agent/execution/plan.yaml" || true)"
    case "${PLAN_ID}" in
      pb-[0-9]*) echo "DRY_RUN=would_commit docs: finalize discuss plan ${PLAN_ID}" ;;
      *) echo "DRY_RUN=would_commit docs: finalize discuss plan updates" ;;
    esac
  else
    echo "DRY_RUN=commit_disabled_by_config"
  fi
  if [ "${PUSH_ENABLED}" = "true" ]; then
    if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
      echo "DRY_RUN=would_git_pull_rebase"
    fi
    echo "DRY_RUN=would_git_push"
  fi
  echo "DISCUSS_PLAN_FINALIZED=DRY_RUN"
  exit 0
fi

if [ "${COMMIT_ENABLED}" = "false" ]; then
  echo "FINALIZE_MODE=no_commit_no_push"
  echo "DISCUSS_PLAN_FINALIZED=SKIPPED_BY_CONFIG"
  exit 0
fi

PLAN_ID="$(extract_plan_id_yaml "${PLAN_FILE}" || true)"
if printf '%s\n' "${PLAN_ID}" | grep -Eq '^pb-[0-9]+$'; then
  python3 - "${TELEMETRY_TEMPLATE}" "${TELEMETRY_FILE}" "${PLAN_ID}" <<'PY'
import sys
from pathlib import Path

content = Path(sys.argv[1]).read_text(encoding="utf-8")
Path(sys.argv[2]).write_text(content.replace("__PLAN_ID__", sys.argv[3]), encoding="utf-8")
PY
fi

git add -- "$@" "${TELEMETRY_FILE}"

if git diff --cached --quiet; then
  echo "No staged discussion document changes after git add." >&2
  exit 5
fi

case "${PLAN_ID}" in
  pb-[0-9]*)
    run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: finalize discuss plan ${PLAN_ID}" git commit -m "docs: finalize discuss plan ${PLAN_ID}"
    ;;
  *)
    run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: finalize discuss plan updates" git commit -m "docs: finalize discuss plan updates"
    ;;
esac

if [ "${PUSH_ENABLED}" = "true" ]; then
  if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
    run_write_command "${EXECUTION_CONFIG}" "would_git_pull_rebase" git pull -r
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_git_push" git push
fi

echo "DISCUSS_PLAN_FINALIZED=1"
