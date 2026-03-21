#!/usr/bin/env sh
set -eu

require_file() {
  path="$1"
  if [ ! -f "$path" ]; then
    echo "Required file missing: $path" >&2
    exit 20
  fi
  echo "LOAD=$path"
}

emit_optional_load() {
  path="$1"
  if [ -f "$path" ]; then
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
