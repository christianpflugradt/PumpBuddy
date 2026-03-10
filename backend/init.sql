BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS training_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS load_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    display_unit TEXT NOT NULL,
    canonical_unit TEXT NOT NULL DEFAULT 'kg',
    min_display_load NUMERIC(8, 2),
    max_display_load NUMERIC(8, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT load_profiles_display_unit_check CHECK (display_unit IN ('kg', 'lbs')),
    CONSTRAINT load_profiles_canonical_unit_check CHECK (canonical_unit = 'kg'),
    CONSTRAINT load_profiles_bounds_check CHECK (
        min_display_load IS NULL
        OR max_display_load IS NULL
        OR min_display_load <= max_display_load
    )
);

CREATE TABLE IF NOT EXISTS load_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_profile_id UUID NOT NULL REFERENCES load_profiles(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    display_value NUMERIC(8, 2) NOT NULL,
    canonical_value_kg NUMERIC(8, 3) NOT NULL,
    CONSTRAINT load_steps_position_positive_check CHECK (position > 0),
    CONSTRAINT load_steps_display_non_negative_check CHECK (display_value >= 0),
    CONSTRAINT load_steps_canonical_non_negative_check CHECK (canonical_value_kg >= 0),
    CONSTRAINT load_steps_profile_display_unique UNIQUE (load_profile_id, display_value),
    CONSTRAINT load_steps_profile_position_unique UNIQUE (load_profile_id, position)
);

CREATE TABLE IF NOT EXISTS equipment_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    load_profile_id UUID NOT NULL REFERENCES load_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT equipment_stations_gym_name_unique UNIQUE (gym_id, name),
    CONSTRAINT equipment_stations_id_gym_unique UNIQUE (id, gym_id)
);

CREATE TABLE IF NOT EXISTS training_plan_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    position INTEGER NOT NULL,
    target_sets INTEGER,
    target_reps_min INTEGER,
    target_reps_max INTEGER,
    CONSTRAINT training_plan_exercises_position_positive_check CHECK (position > 0),
    CONSTRAINT training_plan_exercises_target_sets_positive_check CHECK (
        target_sets IS NULL OR target_sets > 0
    ),
    CONSTRAINT training_plan_exercises_target_reps_min_positive_check CHECK (
        target_reps_min IS NULL OR target_reps_min > 0
    ),
    CONSTRAINT training_plan_exercises_target_reps_max_positive_check CHECK (
        target_reps_max IS NULL OR target_reps_max > 0
    ),
    CONSTRAINT training_plan_exercises_target_reps_range_check CHECK (
        target_reps_min IS NULL
        OR target_reps_max IS NULL
        OR target_reps_min <= target_reps_max
    ),
    CONSTRAINT training_plan_exercises_plan_position_unique UNIQUE (training_plan_id, position)
);

CREATE TABLE IF NOT EXISTS exercise_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    variant_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exercise_variants_exercise_name_unique UNIQUE (exercise_id, name)
);

CREATE TABLE IF NOT EXISTS exercise_variant_equipment_compatibilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_variant_id UUID NOT NULL REFERENCES exercise_variants(id) ON DELETE CASCADE,
    equipment_station_id UUID NOT NULL REFERENCES equipment_stations(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exercise_variant_equipment_compatibilities_unique UNIQUE (
        exercise_variant_id,
        equipment_station_id
    )
);

CREATE TABLE IF NOT EXISTS plan_exercise_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_plan_exercise_id UUID NOT NULL REFERENCES training_plan_exercises(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    exercise_variant_id UUID NOT NULL REFERENCES exercise_variants(id) ON DELETE CASCADE,
    equipment_station_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT plan_exercise_options_station_in_gym_fk FOREIGN KEY (equipment_station_id, gym_id)
        REFERENCES equipment_stations (id, gym_id),
    CONSTRAINT plan_exercise_options_unique UNIQUE (
        training_plan_exercise_id,
        gym_id,
        exercise_variant_id,
        equipment_station_id
    )
);

CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_plan_id UUID NOT NULL REFERENCES training_plans(id),
    gym_id UUID NOT NULL REFERENCES gyms(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workouts_completion_after_start_check CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    )
);

CREATE TABLE IF NOT EXISTS workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    training_plan_exercise_id UUID NOT NULL REFERENCES training_plan_exercises(id),
    position INTEGER NOT NULL,
    selected_variant_id UUID REFERENCES exercise_variants(id),
    selected_station_id UUID REFERENCES equipment_stations(id),
    selected_plan_exercise_option_id UUID REFERENCES plan_exercise_options(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workout_exercises_position_positive_check CHECK (position > 0),
    CONSTRAINT workout_exercises_workout_position_unique UNIQUE (workout_id, position)
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_index INTEGER NOT NULL,
    reps INTEGER,
    load_display_value NUMERIC(8, 2) NOT NULL,
    load_display_unit TEXT NOT NULL,
    load_canonical_kg NUMERIC(8, 3) NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workout_sets_set_index_positive_check CHECK (set_index > 0),
    CONSTRAINT workout_sets_reps_positive_check CHECK (reps IS NULL OR reps > 0),
    CONSTRAINT workout_sets_display_non_negative_check CHECK (load_display_value >= 0),
    CONSTRAINT workout_sets_canonical_non_negative_check CHECK (load_canonical_kg >= 0),
    CONSTRAINT workout_sets_load_display_unit_check CHECK (load_display_unit IN ('kg', 'lbs')),
    CONSTRAINT workout_sets_workout_exercise_set_index_unique UNIQUE (workout_exercise_id, set_index)
);

COMMIT;
