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
