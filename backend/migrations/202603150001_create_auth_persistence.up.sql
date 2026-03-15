CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login_name TEXT,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disabled_at TIMESTAMPTZ
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
