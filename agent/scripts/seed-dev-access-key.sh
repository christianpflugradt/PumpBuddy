#!/usr/bin/env bash
set -euo pipefail

readonly DEV_USER_ID="00000000-0000-0000-0000-000000000001"
readonly USER_A_ID="00000000-0000-0000-0000-000000000011"
readonly USER_B_ID="00000000-0000-0000-0000-000000000012"

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

dev_access_key="$(generate_random_alnum)"
dev_salt="$(generate_random_alnum)"
dev_access_key_hash="$(printf '%s' "$dev_access_key" | argon2 "$dev_salt" -id -e)"

user_a_access_key="$(generate_random_alnum)"
user_a_salt="$(generate_random_alnum)"
user_a_access_key_hash="$(printf '%s' "$user_a_access_key" | argon2 "$user_a_salt" -id -e)"

user_b_access_key="$(generate_random_alnum)"
user_b_salt="$(generate_random_alnum)"
user_b_access_key_hash="$(printf '%s' "$user_b_access_key" | argon2 "$user_b_salt" -id -e)"

docker compose exec -T postgres \
  psql \
  --username pumpbuddy \
  --dbname pumpbuddy \
  --set ON_ERROR_STOP=1 \
  --set="dev_secret_hash=$dev_access_key_hash" \
  --set="user_a_secret_hash=$user_a_access_key_hash" \
  --set="user_b_secret_hash=$user_b_access_key_hash" \
  <<SQL
INSERT INTO users (id, login_name, display_name, disabled_at)
VALUES
  ('${DEV_USER_ID}', 'main', 'Main User', NULL),
  ('${USER_A_ID}', 'user-a', 'User A', NULL),
  ('${USER_B_ID}', 'user-b', 'User B', NULL)
ON CONFLICT (id) DO UPDATE SET
  login_name = EXCLUDED.login_name,
  display_name = EXCLUDED.display_name,
  disabled_at = NULL;

UPDATE users
SET disabled_at = NOW()
WHERE id NOT IN ('${DEV_USER_ID}', '${USER_A_ID}', '${USER_B_ID}')
  AND disabled_at IS NULL;

UPDATE user_secrets
SET revoked_at = NOW()
WHERE revoked_at IS NULL;

INSERT INTO user_secrets (user_id, secret_hash, label)
VALUES
  ('${DEV_USER_ID}', :'dev_secret_hash', 'primary'),
  ('${USER_A_ID}', :'user_a_secret_hash', 'primary'),
  ('${USER_B_ID}', :'user_b_secret_hash', 'primary');
SQL

printf 'Development Access Key (main): %s\n' "$dev_access_key"
printf 'Development Access Key (user-a): %s\n' "$user_a_access_key"
printf 'Development Access Key (user-b): %s\n' "$user_b_access_key"
