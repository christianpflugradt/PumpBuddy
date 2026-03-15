Plan for adding user ownership and scoping

1) Add DB migrations to introduce nullable `user_id UUID REFERENCES users(id)` columns on user-owned domain tables:
   - workouts, workout_exercises, workout_sets, training_plans, training_plan_exercises, plan_exercise_options
   - Keep existing seed data untouched (nullable columns). Update `init.sql` to include the new columns for local dev

2) Update persistence layer to include `user_id` for reads/writes on those tables. New function signatures will accept `user_id: &str`.

3) Update HTTP handlers: extract authenticated session from request extensions (middleware already provides it) and pass `session.user_id` into repository calls for all `/api` endpoints.

4) Run backend tests (developer will run locally). If migration needs a backfill to make columns NOT NULL later, do that in a future task.

This file will be removed after implementation.
