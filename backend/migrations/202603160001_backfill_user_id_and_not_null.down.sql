-- Revert NOT NULL constraints added by the up migration

BEGIN;

ALTER TABLE training_plans ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE training_plan_exercises ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE plan_exercise_options ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE workouts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE workout_exercises ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE workout_sets ALTER COLUMN user_id DROP NOT NULL;

COMMIT;
