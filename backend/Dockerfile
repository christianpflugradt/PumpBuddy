FROM rust:1.94-bookworm@sha256:fdb91abf3cb33f1ebc84a76461d2472fd8cf606df69c181050fa7474bade2895 AS base

WORKDIR /app

COPY Cargo.toml ./
COPY Cargo.lock ./
COPY src ./src
COPY tests ./tests
COPY init.sql ./init.sql
COPY target/generated/openapi/rust/src/models ./target/generated/openapi/rust/src/models

FROM base AS builder

RUN cargo build --release

FROM base AS test

CMD ["cargo", "test"]

FROM rust:1.94-bookworm@sha256:fdb91abf3cb33f1ebc84a76461d2472fd8cf606df69c181050fa7474bade2895 AS runtime

ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=8080

WORKDIR /app

COPY Cargo.toml ./
COPY Cargo.lock ./
COPY src ./src
COPY tests ./tests
COPY init.sql ./init.sql
COPY target/generated/openapi/rust/src/models ./target/generated/openapi/rust/src/models

COPY --from=builder /app/target/release/pumpbuddy-backend /usr/local/bin/pumpbuddy-backend

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/pumpbuddy-backend"]
