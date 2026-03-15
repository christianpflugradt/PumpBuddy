# Migration Verification

For PostgreSQL-backed verification in local development:

1. Start the test database runtime:

`docker compose --profile test up -d postgres-test`

2. Run a persistence test that applies `backend/init.sql` and exercises seeded auth-compatible schema setup:

`cargo test --manifest-path backend/Cargo.toml --lib persistence::tests::fetch_training_plan_summaries_returns_seed_plans -- --nocapture`
