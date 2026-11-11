# Pin a stable compiler image for reproducible builds, independently of host Rust.
ARG RUST_TOOLCHAIN=1.97.1
FROM rust:${RUST_TOOLCHAIN}-bookworm@sha256:0e2bcaef56d041a486784e54104a81aebe0da44bd03019bd70bc0401e42e4a97 AS base

WORKDIR /app

COPY ["Cargo.toml", "Cargo.lock", "build.rs", "./"]
COPY ["src", "./src"]
COPY ["tests", "./tests"]
COPY ["target/generated/openapi/rust/src/models", "./target/generated/openapi/rust/src/models"]

FROM base AS builder

ARG APP_VERSION
ARG BUILD_COMMIT
ARG BUILD_TIMESTAMP
ENV APP_VERSION=${APP_VERSION}
ENV BUILD_COMMIT=${BUILD_COMMIT}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

RUN cargo build --release

FROM base AS test

CMD ["cargo", "test"]

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc AS runtime

ARG APP_VERSION
ARG BUILD_COMMIT
LABEL org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${BUILD_COMMIT}" \
      org.opencontainers.image.source="https://github.com/christianpflugradt/PumpBuddy"

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=8080

WORKDIR /app

COPY --from=builder /app/target/release/pumpbuddy-backend /usr/local/bin/pumpbuddy-backend

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/pumpbuddy-backend"]
