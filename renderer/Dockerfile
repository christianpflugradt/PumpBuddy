FROM node:24-bookworm-slim@sha256:24dc26ef1e3c3690f27ebc4136c9c186c3133b25563ae4d7f0692e4d1fe5db0e AS builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM caddy:2.11-alpine@sha256:86deaf5e3d3408a6ccec08fbb79989783dd26e206ae10bcf78a801dc8c9ab794 AS runtime

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv

EXPOSE 80
