# Runtime Quickstart

This folder contains runtime-ready Docker Compose setup for local development and production deployment.

Production deployment assumes an external reverse proxy terminates TLS before requests
reach PumpBuddy. The bundled production compose file exposes the renderer only on
`127.0.0.1:8080` for that upstream hop and is not intended to be published directly
to the internet.

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
- `BOOTSTRAP_SECRET_VOLUME_NAME` (recommended default: `pumpbuddy-bootstrap-secret-handoff`)
- `COMPOSE_PROJECT_NAME` (recommended default: `pumpbuddy`)

3. Create the persistent production volume once (safe to re-run):

```bash
docker volume create pumpbuddy-postgres-data
docker volume create pumpbuddy-bootstrap-secret-handoff
```

4. Start the production stack:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml up -d
```

5. Point your external reverse proxy at `http://127.0.0.1:8080` on the Docker host.
   Terminate TLS at that proxy. Do not publish the PumpBuddy renderer port directly
   to the internet. Configure that proxy to overwrite forwarded client-address
   headers, not pass through user-supplied values; the renderer normalizes the
   trusted client address before forwarding auth requests to the internal backend.

6. Retrieve the initial access key from the one-time handoff file (first startup only):

The one-shot `init-access-key` service creates an access key only when `users` is empty and writes it with restrictive permissions to `/bootstrap-secrets/initial-access-key` inside the bootstrap handoff volume.

Use login name `admin` together with that initial access key on the first sign-in.

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml run --rm --no-deps --entrypoint /bin/cat init-access-key /bootstrap-secrets/initial-access-key
```

7. Rotate the bootstrap key immediately and remove the handoff file:

```bash
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml run --rm --no-deps --entrypoint /bin/sh init-access-key -lc 'rm -f /bootstrap-secrets/initial-access-key'
docker compose --env-file runtime/compose/.env.prod -f runtime/compose/compose.prod.yaml run --rm --no-deps --entrypoint /bin/sh init-access-key -lc 'test ! -e /bootstrap-secrets/initial-access-key'
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
