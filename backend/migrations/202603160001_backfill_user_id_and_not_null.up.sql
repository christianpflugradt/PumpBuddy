-- Backfill NULL user_id values to a seeded development user and enforce NOT NULL
-- Use the dev user id seeded in backend/init.sql: 00000000-0000-0000-0000-000000000001

BEGIN;

UPDATE training_plans SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE training_plan_exercises SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE plan_exercise_options SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;

UPDATE workouts SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE workout_exercises SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE workout_sets SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;

ALTER TABLE training_plans ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE training_plan_exercises ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE plan_exercise_options ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE workouts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE workout_exercises ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE workout_sets ALTER COLUMN user_id SET NOT NULL;

COMMIT;
