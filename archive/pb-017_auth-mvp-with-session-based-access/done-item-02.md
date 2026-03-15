# Seed development access key

## Goal

Make `make rebuild-app` seed a development access key by generating one random cleartext key, printing it once for operator use, and persisting only its Argon2id hash.

## Scope

- add or update rebuild-time initialization logic to create one active user and one active secret for development
- generate a random access key during rebuild and hash it with Argon2id before persistence
- print the generated access key to CLI once without writing it to database state

## Acceptance Criteria

- running `make rebuild-app` prints one generated development access key in CLI output
- database state after rebuild contains only hashed secret material and no cleartext access key
- an executable verification step is documented and passes, for example `make rebuild-app`

## References

- `agent/strategy/plan.md`
- `AUTH_CONCEPT.md`
- `agent/strategy/security-baseline.md`
- `Makefile`


## Review Acceptance

- Criteria Met: `make rebuild-app` now seeds one development user and one active secret, prints exactly one generated development access key line, stores only Argon2id hash material in `user_secrets`, and documents an executable verification flow in `README.md`.
- Evidence: `Makefile` runs `agent/scripts/seed-dev-access-key.sh` in `rebuild-app`; the script generates random key and salt, hashes via `argon2 ... -id -e`, inserts only `secret_hash`, revokes previous active secrets, and prints `Development Access Key: ...` once. Commit `444852d` also adds verification docs under “Development Access Key Seeding Verification” in `README.md`.
- Runtime/Build Check: Executed `make rebuild-app`; observed result: Compose stack rebuilt successfully, SQL seed statements completed (`INSERT/UPDATE/INSERT`), and exactly one key line was printed (`Development Access Key: AIRSzzQB27yh2cXkp44qqHCnb50rL1px`). Follow-up DB checks confirmed `active_secret_count=1`, `non_argon2_hash_count=0`, and `cleartext_match_count=0`.
- Residual Risk: Minor operational dependency on local `argon2` CLI availability for the seeding script; otherwise none identified for this item’s acceptance criteria.
