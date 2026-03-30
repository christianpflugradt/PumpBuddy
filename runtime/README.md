# Runtime Quickstart

This folder contains runtime-ready Docker Compose setup for local development and production deployment.

## Files

- `compose/compose.dev.yaml`: builds images from local source (development)
- `compose/compose.prod.yaml`: runs published GHCR images (production)
- `compose/.env.prod.example`: environment variable template for production
- `database/00-schema.sql`: schema only
- `database/10-seed-dev.sql`: development seed data

## Production Start

1. Prepare an environment file:

```bash
cp runtime/compose/.env.prod.example runtime/compose/.env.prod
```

2. Set required values in `runtime/compose/.env.prod`:

- `APP_VERSION`
- `POSTGRES_PASSWORD`
- `POSTGRES_VOLUME_NAME` (recommended default: `pumpbuddy-postgres-data`)
- `COMPOSE_PROJECT_NAME` (recommended default: `pumpbuddy`)

3. Create the persistent production volume once (safe to re-run):

```bash
docker volume create pumpbuddy-postgres-data
```

4. Start the production stack:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml up -d
```

5. Retrieve the initial access key (first startup only):

The one-shot `init-access-key` service creates an access key only when `users` is empty and prints it once:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml logs init-access-key
```

## Safe Production Updates

Do not run `docker compose down --volumes` in production.

Use this update pattern instead:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml pull
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml up -d
```

## Development Start

Use the Makefile for local development:

```bash
make run-app
```

Builds local images from source, starts the stack, and seeds development data.

```bash
make stop-app
```

Stops and removes the development stack containers.

```bash
make rebuild-app
```

Rebuilds and restarts the development stack from scratch and reseeds the database.
