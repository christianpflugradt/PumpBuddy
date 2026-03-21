# Operations Guide

This document contains local runtime and operational verification procedures.

## Local Stack Commands

Use Makefile shortcuts from repository root:

- `make run-app` starts existing stack in detached mode (no rebuild)
- `make rebuild-app` resets stack/volumes, rebuilds images, seeds one development access key
- `make stop-app` stops services without removing volumes

## Development Access Key Seeding Verification

Run:

```bash
make rebuild-app
```

Expected:

- exactly one `Development Access Key: ...` line in output
- DB stores only hash material, no cleartext key

Optional DB check:

```bash
docker compose exec -T postgres psql -U pumpbuddy -d pumpbuddy -c "SELECT user_id, secret_hash, revoked_at FROM user_secrets ORDER BY created_at DESC LIMIT 3;"
```

## Compose Runtime Verification

1. Build and start:

```bash
docker compose up --build -d
```

2. Check runtime:

```bash
docker compose ps
```

Expected: renderer exposes `0.0.0.0:8080->80/tcp`; backend/postgres internal only.

3. Check renderer reachability:

```bash
for attempt in {1..30}; do
  if curl --fail --show-error --silent http://localhost:8080 >/dev/null; then
    echo "renderer reachable"
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "renderer not reachable after 30s" >&2
    exit 1
  fi
  sleep 1
done
```

4. Tear down:

```bash
docker compose down
```

Optional full cleanup:

```bash
docker compose down --volumes
```

## Compose Test Verification

Run backend tests in dedicated test profile:

```bash
docker compose --profile test up --build --abort-on-container-exit --exit-code-from backend-test backend-test
```

Cleanup:

```bash
docker compose --profile test down
```

## Coverage Badge Publication

Coverage badges are published to GitHub Pages:

- `https://christianpflugradt.github.io/PumpBuddy/badges/backend-coverage.json`
- `https://christianpflugradt.github.io/PumpBuddy/badges/renderer-coverage.json`

Prepare equivalent local Pages artifact:

```bash
agent/scripts/prepare-pages-artifacts.sh
```
