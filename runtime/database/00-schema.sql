BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login_name TEXT,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disabled_at TIMESTAMPTZ,
    CONSTRAINT users_login_name_unique UNIQUE (login_name)
);

CREATE TABLE IF NOT EXISTS user_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    secret_hash TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    rotated_by_user_id UUID REFERENCES users(id),
    rotation_reason TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idle_expires_at TIMESTAMPTZ NOT NULL,
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_session_id UUID REFERENCES sessions(id),
    user_agent TEXT,
    ip_address TEXT,
    device_label TEXT,
    revoke_reason TEXT,
    CONSTRAINT sessions_token_hash_unique UNIQUE (session_token_hash),
    CONSTRAINT sessions_idle_not_before_created_check CHECK (idle_expires_at >= created_at),
    CONSTRAINT sessions_absolute_not_before_created_check CHECK (
        absolute_expires_at >= created_at
    )
);

CREATE TABLE IF NOT EXISTS training_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT training_plan_versions_version_positive_check CHECK (version_number > 0),
    CONSTRAINT training_plan_versions_plan_version_unique UNIQUE (training_plan_id, version_number)
);

CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exercises_name_user_unique UNIQUE (name, user_id),
    CONSTRAINT exercises_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gyms_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS load_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    weight_unit TEXT NOT NULL,
    definition JSONB NOT NULL,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT load_profiles_id_user_unique UNIQUE (id, user_id),
    CONSTRAINT load_profiles_weight_unit_check CHECK (weight_unit IN ('KG', 'LBS')),
    CONSTRAINT load_profiles_definition_has_kind_check CHECK (definition ? 'kind'),
    CONSTRAINT load_profiles_definition_kind_check CHECK ((definition->>'kind') IN ('fixed_list', 'formula')),
    CONSTRAINT load_profiles_fixed_list_values_check CHECK (
        (definition->>'kind') <> 'fixed_list' OR definition ? 'values'
    ),
    CONSTRAINT load_profiles_formula_fields_check CHECK (
        (definition->>'kind') <> 'formula' OR (definition ? 'min' AND definition ? 'step')
    )
);

CREATE TABLE IF NOT EXISTS equipment_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL,
    name TEXT NOT NULL,
    load_profile_id UUID NOT NULL,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT equipment_stations_gym_name_unique UNIQUE (gym_id, user_id, name),
    CONSTRAINT equipment_stations_id_user_unique UNIQUE (id, user_id),
    CONSTRAINT equipment_stations_gym_user_fk FOREIGN KEY (gym_id, user_id)
        REFERENCES gyms (id, user_id)
        ON DELETE CASCADE,
    CONSTRAINT equipment_stations_load_profile_user_fk FOREIGN KEY (load_profile_id, user_id)
        REFERENCES load_profiles (id, user_id)
);

CREATE TABLE IF NOT EXISTS training_plan_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_plan_version_id UUID NOT NULL REFERENCES training_plan_versions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    position INTEGER NOT NULL,
    CONSTRAINT training_plan_exercises_position_positive_check CHECK (position > 0),
    CONSTRAINT training_plan_exercises_version_position_unique UNIQUE (
        training_plan_version_id,
        position
    )
);

CREATE TABLE IF NOT EXISTS exercise_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL,
    name TEXT NOT NULL,
    variant_type TEXT NOT NULL,
    requires_station BOOLEAN NOT NULL DEFAULT TRUE,
    load_input_mode TEXT NOT NULL DEFAULT 'TOTAL',
    set_tracking_mode TEXT NOT NULL DEFAULT 'BILATERAL',
    repetition_kind TEXT NOT NULL DEFAULT 'REPS',
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exercise_variants_exercise_name_unique UNIQUE (exercise_id, user_id, name),
    CONSTRAINT exercise_variants_id_user_unique UNIQUE (id, user_id),
    CONSTRAINT exercise_variants_exercise_user_fk FOREIGN KEY (exercise_id, user_id)
        REFERENCES exercises (id, user_id)
        ON DELETE CASCADE,
    CONSTRAINT exercise_variants_load_input_mode_check CHECK (
        load_input_mode IN ('TOTAL', 'PER_SIDE')
    ),
    CONSTRAINT exercise_variants_set_tracking_mode_check CHECK (
        set_tracking_mode IN ('UNILATERAL', 'BILATERAL')
    ),
    CONSTRAINT exercise_variants_repetition_kind_check CHECK (
        repetition_kind IN ('REPS', 'SECS')
    )
);

CREATE TABLE IF NOT EXISTS exercise_variant_equipment_compatibilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_variant_id UUID NOT NULL,
    equipment_station_id UUID NOT NULL,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exercise_variant_equipment_compatibilities_unique UNIQUE (
        exercise_variant_id,
        equipment_station_id
    ),
    CONSTRAINT exercise_variant_equipment_compatibilities_variant_user_fk FOREIGN KEY (exercise_variant_id, user_id)
        REFERENCES exercise_variants (id, user_id)
        ON DELETE CASCADE,
    CONSTRAINT exercise_variant_equipment_compatibilities_station_user_fk FOREIGN KEY (equipment_station_id, user_id)
        REFERENCES equipment_stations (id, user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plan_exercise_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_plan_exercise_id UUID NOT NULL REFERENCES training_plan_exercises(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    exercise_variant_id UUID NOT NULL REFERENCES exercise_variants(id) ON DELETE CASCADE,
    selection_order INTEGER NOT NULL,
    rep_min INTEGER,
    rep_max INTEGER,
    target_sets INTEGER DEFAULT NULL,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT plan_exercise_options_selection_order_positive_check CHECK (selection_order > 0),
    CONSTRAINT plan_exercise_options_rep_min_positive_check CHECK (
        rep_min IS NULL OR rep_min > 0
    ),
    CONSTRAINT plan_exercise_options_rep_max_positive_check CHECK (
        rep_max IS NULL OR rep_max > 0
    ),
    CONSTRAINT plan_exercise_options_rep_range_check CHECK (
        rep_min IS NULL OR rep_max IS NULL OR rep_min <= rep_max
    ),
    CONSTRAINT plan_exercise_options_target_sets_check CHECK (target_sets IS NULL OR target_sets >= 1),
    CONSTRAINT plan_exercise_options_unique UNIQUE (
        training_plan_exercise_id,
        gym_id,
        exercise_variant_id
    ),
    CONSTRAINT plan_exercise_options_selection_order_unique UNIQUE (
        training_plan_exercise_id,
        gym_id,
        selection_order
    )
);

CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_plan_version_id UUID NOT NULL REFERENCES training_plan_versions(id),
    gym_id UUID REFERENCES gyms(id),
    user_id UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    current_exercise_position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workouts_current_exercise_position_positive_check CHECK (
        current_exercise_position IS NULL OR current_exercise_position > 0
    ),
    CONSTRAINT workouts_completion_after_start_check CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    ),
    CONSTRAINT workouts_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    training_plan_exercise_id UUID NOT NULL REFERENCES training_plan_exercises(id),
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    position INTEGER NOT NULL,
    selected_variant_id UUID REFERENCES exercise_variants(id),
    selected_station_id UUID REFERENCES equipment_stations(id),
    selected_plan_exercise_option_id UUID REFERENCES plan_exercise_options(id),
    skipped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workout_exercises_position_positive_check CHECK (position > 0),
    CONSTRAINT workout_exercises_workout_position_unique UNIQUE (workout_id, position),
    CONSTRAINT workout_exercises_id_user_unique UNIQUE (id, user_id),
    CONSTRAINT workout_exercises_workout_user_fk FOREIGN KEY (workout_id, user_id)
        REFERENCES workouts (id, user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
    set_index INTEGER NOT NULL,
    set_side TEXT NOT NULL DEFAULT 'BILATERAL',
    repetition_value INTEGER,
    load_display_value NUMERIC(8, 2),
    load_display_unit TEXT NOT NULL,
    load_canonical_kg NUMERIC(8, 3),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workout_sets_set_index_positive_check CHECK (set_index > 0),
    CONSTRAINT workout_sets_repetition_value_positive_check CHECK (
        repetition_value IS NULL OR repetition_value > 0
    ),
    CONSTRAINT workout_sets_display_non_negative_check CHECK (load_display_value IS NULL OR load_display_value >= 0),
    CONSTRAINT workout_sets_canonical_non_negative_check CHECK (load_canonical_kg IS NULL OR load_canonical_kg >= 0),
    CONSTRAINT workout_sets_load_display_unit_check CHECK (load_display_unit IN ('kg', 'lbs')),
    CONSTRAINT workout_sets_set_side_check CHECK (set_side IN ('LEFT', 'RIGHT', 'BILATERAL')),
    CONSTRAINT workout_sets_workout_exercise_set_index_side_unique UNIQUE (
        workout_exercise_id,
        set_index,
        set_side
    ),
    CONSTRAINT workout_sets_workout_exercise_user_fk FOREIGN KEY (workout_exercise_id, user_id)
        REFERENCES workout_exercises (id, user_id)
        ON DELETE CASCADE
);

COMMIT;
