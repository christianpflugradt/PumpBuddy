# Runtime Quickstart

This folder contains runtime-ready Docker Compose setup for local development and production deployment.

## Files

- `compose/compose.dev.yaml`: builds images from local source (development)
- `compose/compose.prod.yaml`: runs published GHCR images (production)
- `compose/.env.prod.example`: environment variable template for production
- `database/00-schema.sql`: schema only
- `database/10-seed-dev.sql`: development seed data

## Production Start (Copy/Paste)

1. Prepare environment file:

```bash
cp runtime/compose/.env.prod.example runtime/compose/.env.prod
```

2. Edit `runtime/compose/.env.prod` and set at least:

- `APP_VERSION`
- `POSTGRES_PASSWORD`

3. Start production stack:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml up -d
```

## Initial Access Key (First Start Only)

On first startup, the one-shot `init-access-key` service creates an initial access key when the
`users` table is empty and prints it once to logs:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml logs init-access-key
```

## Development Start

```bash
make run-app
```
