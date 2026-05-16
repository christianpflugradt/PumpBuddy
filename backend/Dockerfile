# Keep this version in lockstep with backend rust-toolchain.toml.
ARG RUST_TOOLCHAIN=1.94
FROM rust:${RUST_TOOLCHAIN}-bookworm@sha256:6ae102bdbf528294bc79ad6e1fae682f6f7c2a6e6621506ba959f9685b308a55 AS base

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

FROM debian:bookworm-slim@sha256:67b30a61dc87758f0caf819646104f29ecbda97d920aaf5edc834128ac8493d3 AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=8080

WORKDIR /app

COPY --from=builder /app/target/release/pumpbuddy-backend /usr/local/bin/pumpbuddy-backend

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/pumpbuddy-backend"]
