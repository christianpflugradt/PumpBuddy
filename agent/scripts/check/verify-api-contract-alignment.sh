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
backend_api_surface_changed="false"
renderer_api_boundary_changed="false"
contract_only_reason="${API_CONTRACT_ONLY_REASON:-}"

for file in ${changed_files}; do
  case "${file}" in
    agent/design/api-contract.yaml)
      contract_changed="true"
      ;;
    backend/src/api/**)
      backend_api_surface_changed="true"
      ;;
    renderer/src/openapi-contract.ts|renderer/src/workout-contract-state.ts|renderer/src/workout-contract.ts|renderer/src/workout-api.ts)
      renderer_api_boundary_changed="true"
      ;;
  esac
done

contract_only_reason="$(printf '%s\n' "${contract_only_reason}" | awk 'NF {print; exit}')"
if [ -z "${contract_only_reason}" ]; then
  contract_only_reason="$(
    git show -s --format=%B "${source_commit}" |
      sed -n 's/^API-Contract-Only-Reason:[[:space:]]*//p' |
      awk 'NF {print; exit}'
  )"
fi

if [ "${backend_api_surface_changed}" = "true" ] && [ "${contract_changed}" != "true" ]; then
  echo "API contract alignment failed: API surface changed without updating agent/design/api-contract.yaml" >&2
  echo "Changed files:" >&2
  printf '%s\n' "${changed_files}" >&2
  exit 41
fi

if [ "${contract_changed}" = "true" ] && [ "${backend_api_surface_changed}" != "true" ] && [ "${renderer_api_boundary_changed}" != "true" ]; then
  if [ -z "${contract_only_reason}" ]; then
    echo "API contract alignment failed: agent/design/api-contract.yaml changed without a matching API-surface change or API-Contract-Only-Reason trailer" >&2
    echo "Changed files:" >&2
    printf '%s\n' "${changed_files}" >&2
    exit 42
  fi

  echo "API_CONTRACT_ALIGNMENT=passed_contract_only_allowed"
  echo "API_CONTRACT_ONLY_REASON=${contract_only_reason}"
  exit 0
fi

if [ "${renderer_api_boundary_changed}" = "true" ] && [ "${backend_api_surface_changed}" != "true" ] && [ "${contract_changed}" != "true" ]; then
  echo "API_CONTRACT_ALIGNMENT=passed_renderer_boundary_consumption_only"
  exit 0
fi

echo "API_CONTRACT_ALIGNMENT=passed"
