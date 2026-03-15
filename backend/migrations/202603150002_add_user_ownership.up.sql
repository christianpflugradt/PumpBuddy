-- Add nullable user_id to user-owned domain tables
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE training_plan_exercises ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE plan_exercise_options ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
