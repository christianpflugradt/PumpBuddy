-- Remove user_id columns
ALTER TABLE plan_exercise_options DROP COLUMN IF EXISTS user_id;
ALTER TABLE training_plan_exercises DROP COLUMN IF EXISTS user_id;
ALTER TABLE training_plans DROP COLUMN IF EXISTS user_id;
ALTER TABLE workout_sets DROP COLUMN IF EXISTS user_id;
ALTER TABLE workout_exercises DROP COLUMN IF EXISTS user_id;
ALTER TABLE workouts DROP COLUMN IF EXISTS user_id;
