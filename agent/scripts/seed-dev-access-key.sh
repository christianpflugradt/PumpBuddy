#!/usr/bin/env bash
set -euo pipefail

readonly DEV_USER_ID="00000000-0000-0000-0000-000000000001"

if ! command -v argon2 >/dev/null 2>&1; then
  echo "Missing dependency: argon2 CLI is required for dev access key seeding." >&2
  exit 1
fi

generate_random_alnum() {
  python3 - <<'PY'
import secrets
import string

alphabet = string.ascii_letters + string.digits
print(''.join(secrets.choice(alphabet) for _ in range(32)))
PY
}

access_key="$(generate_random_alnum)"
salt="$(generate_random_alnum)"
access_key_hash="$(printf '%s' "$access_key" | argon2 "$salt" -id -e)"

docker compose exec -T postgres \
  psql \
  --username pumpbuddy \
  --dbname pumpbuddy \
  --set ON_ERROR_STOP=1 \
  --set="secret_hash=$access_key_hash" \
  <<SQL
INSERT INTO users (id, login_name, display_name, disabled_at)
VALUES ('${DEV_USER_ID}', 'dev', 'Developer', NULL)
ON CONFLICT (id) DO UPDATE SET
  login_name = EXCLUDED.login_name,
  display_name = EXCLUDED.display_name,
  disabled_at = NULL;

UPDATE users
SET disabled_at = NOW()
WHERE id <> '${DEV_USER_ID}'
  AND disabled_at IS NULL;

UPDATE user_secrets
SET revoked_at = NOW()
WHERE revoked_at IS NULL;

INSERT INTO user_secrets (user_id, secret_hash, label)
VALUES ('${DEV_USER_ID}', :'secret_hash', 'primary');
SQL

printf 'Development Access Key: %s\n' "$access_key"
