#!/usr/bin/env sh
set -eu

require_file() {
  path="$1"
  if [ ! -e "$path" ]; then
    echo "Required path missing: $path" >&2
    exit 20
  fi
  echo "LOAD=$path"
}

emit_optional_load() {
  path="$1"
  if [ -e "$path" ]; then
    echo "LOAD=$path"
  fi
}

extract_plan_id_yaml() {
  plan_file="$1"
  python3 - "$plan_file" <<'PY'
import sys
try:
    import yaml
except Exception:
    print("")
    raise SystemExit(0)

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as h:
        data = yaml.safe_load(h) or {}
except Exception:
    print("")
    raise SystemExit(0)
plan_id = data.get("id", "")
print(plan_id if isinstance(plan_id, str) else "")
PY
}

compute_next_plan_id_from_archive() {
  archive_root="$1"

  if [ -d "${archive_root}" ]; then
    find "${archive_root}" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | while IFS= read -r dir; do
      base="$(basename "${dir}")"
      id_part="${base%%_*}"
      case "${id_part}" in
        pb-[0-9]*)
          num="${id_part#pb-}"
          case "${num}" in
            ''|*[!0-9]*) continue ;;
          esac
          width="${#num}"
          num_base10="$(printf '%s' "${num}" | sed 's/^0*//')"
          if [ -z "${num_base10}" ]; then
            num_base10=0
          fi
          printf '%s %s\n' "${num_base10}" "${width}"
          ;;
      esac
    done | awk '
      BEGIN { max_num=0; max_width=3 }
      {
        if ($1 > max_num) {
          max_num=$1
          max_width=$2
        }
      }
      END { printf "%s %s\n", max_num, max_width }
    '
  else
    printf '0 3\n'
  fi
}

read_execution_flag() {
  config_path="$1"
  dotted_key="$2"
  default_value="$3"
  python3 - "$config_path" "$dotted_key" "$default_value" <<'PY'
import sys
try:
    import yaml
except Exception:
    print(sys.argv[3])
    raise SystemExit(0)

path, dotted_key, default = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
except Exception:
    print(default)
    raise SystemExit(0)

node = data
for part in dotted_key.split("."):
    if not isinstance(node, dict) or part not in node:
        print(default)
        raise SystemExit(0)
    node = node[part]

if isinstance(node, bool):
    print("true" if node else "false")
else:
    print(default)
PY
}

execution_dry_run_enabled() {
  config_path="$1"
  read_execution_flag "${config_path}" "runtime.dry_run" "false"
}

execution_telemetry_enabled() {
  config_path="$1"
  read_execution_flag "${config_path}" "telemetry.enabled" "false"
}

run_telemetry_command() {
  config_path="$1"
  telemetry_script="$2"
  shift 2

  telemetry_enabled="$(execution_telemetry_enabled "${config_path}")"
  if [ "${telemetry_enabled}" != "true" ]; then
    return 0
  fi

  if [ ! -f "${telemetry_script}" ]; then
    return 0
  fi

  python3 "${telemetry_script}" "$@"
}

run_write_command() {
  config_path="$1"
  dry_run_label="$2"
  shift 2

  dry_run_enabled="$(execution_dry_run_enabled "${config_path}")"
  if [ "${dry_run_enabled}" = "true" ]; then
    echo "DRY_RUN=${dry_run_label}"
    return 0
  fi

  "$@"
}

append_line_guarded() {
  config_path="$1"
  target_file="$2"
  line="$3"

  dry_run_enabled="$(execution_dry_run_enabled "${config_path}")"
  if [ "${dry_run_enabled}" = "true" ]; then
    echo "DRY_RUN=would_append_line target=${target_file}" >&2
    return 0
  fi

  printf '%s\n' "${line}" >> "${target_file}"
}

ensure_context_runtime() {
  context_config="$1"
  context_loader="$2"

  if [ ! -f "${context_config}" ]; then
    echo "Missing context config: ${context_config}" >&2
    exit 21
  fi

  if [ ! -x "${context_loader}" ]; then
    echo "Missing context loader: ${context_loader}" >&2
    exit 22
  fi
}

emit_context_loads() {
  context_loader="$1"
  context_config="$2"

  "${context_loader}" --config "${context_config}" --mode loads | while IFS="$(printf '\t')" read -r kind path; do
    case "${kind}" in
      required|template_required)
        require_file "${path}"
        ;;
      optional)
        emit_optional_load "${path}"
        ;;
    esac
  done
}

load_execution_git_settings() {
  execution_config="$1"
  COMMIT_ENABLED="$(read_execution_flag "${execution_config}" "git.commit_enabled" "true")"
  PUSH_ENABLED="$(read_execution_flag "${execution_config}" "git.push_enabled" "true")"
  PULL_REBASE_ENABLED="$(read_execution_flag "${execution_config}" "git.pull_rebase_before_push" "true")"
  DRY_RUN_ENABLED="$(read_execution_flag "${execution_config}" "runtime.dry_run" "false")"
  export COMMIT_ENABLED PUSH_ENABLED PULL_REBASE_ENABLED DRY_RUN_ENABLED
}

validate_execution_git_settings() {
  if [ "${COMMIT_ENABLED}" = "false" ] && [ "${PUSH_ENABLED}" = "true" ]; then
    echo "Invalid execution config: push_enabled=true requires commit_enabled=true." >&2
    exit 24
  fi
}

run_push_if_enabled() {
  execution_config="$1"
  if [ "${PUSH_ENABLED}" = "true" ]; then
    if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
      run_write_command "${execution_config}" "would_git_pull_rebase" git pull -r
    fi
    run_write_command "${execution_config}" "would_git_push" git push
  fi
}

record_task_run_finished() {
  execution_config="$1"
  telemetry_script="$2"
  telemetry_file="$3"
  plan_file="$4"
  task_name="$5"
  item_id="${6:-}"

  if [ -n "${item_id}" ]; then
    run_telemetry_command "${execution_config}" "${telemetry_script}" \
      --telemetry-file "${telemetry_file}" \
      --plan-file "${plan_file}" \
      record-event \
      --task "${task_name}" \
      --event-type "task_run_finished" \
      --item-id "${item_id}"
  else
    run_telemetry_command "${execution_config}" "${telemetry_script}" \
      --telemetry-file "${telemetry_file}" \
      --plan-file "${plan_file}" \
      record-event \
      --task "${task_name}" \
      --event-type "task_run_finished"
  fi
}
