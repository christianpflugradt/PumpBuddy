#!/usr/bin/env sh
set -eu

source_commit="${QUALITY_GATE_SOURCE_COMMIT:-}"
if [ -z "${source_commit}" ]; then
  source_commit="$(git rev-parse HEAD)"
fi

changed_files="$(git show --name-only --pretty=format: "${source_commit}" | sed '/^$/d' || true)"
if [ -z "${changed_files}" ]; then
  echo "API_CONTRACT_ALIGNMENT=skipped_no_changed_files"
  exit 0
fi

contract_changed="false"
api_surface_changed="false"

for file in ${changed_files}; do
  case "${file}" in
    agent/design/api-contract.yaml)
      contract_changed="true"
      ;;
    backend/src/api/**|renderer/src/openapi-contract.ts|renderer/src/workout-contract-state.ts|renderer/src/workout-contract.ts|renderer/src/workout-api.ts)
      api_surface_changed="true"
      ;;
  esac
done

if [ "${api_surface_changed}" = "true" ] && [ "${contract_changed}" != "true" ]; then
  echo "API contract alignment failed: API surface changed without updating agent/design/api-contract.yaml" >&2
  echo "Changed files:" >&2
  printf '%s\n' "${changed_files}" >&2
  exit 41
fi

echo "API_CONTRACT_ALIGNMENT=passed"
