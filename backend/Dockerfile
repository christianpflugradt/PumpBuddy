FROM rust:1.88-bookworm AS base

WORKDIR /app

COPY Cargo.toml ./
COPY Cargo.lock ./
COPY src ./src
COPY tests ./tests
COPY init.sql ./init.sql

FROM base AS builder

RUN cargo build --release

FROM base AS test

CMD ["cargo", "test"]

FROM rust:1.88-bookworm AS runtime

ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=8080

WORKDIR /app

COPY Cargo.toml ./
COPY Cargo.lock ./
COPY src ./src
COPY tests ./tests
COPY init.sql ./init.sql

COPY --from=builder /app/target/release/pumpbuddy-backend /usr/local/bin/pumpbuddy-backend

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/pumpbuddy-backend"]
