FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM caddy:2.9-alpine AS runtime

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv

EXPOSE 80
