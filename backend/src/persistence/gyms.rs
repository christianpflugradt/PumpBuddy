use super::{logging, DomainRepository, PersistenceError};
use crate::domain::{
    ConfiguratorExerciseVariantCompatibilitySelection,
    ConfiguratorExerciseVariantCompatibilityStation, ConfiguratorStation,
    ConfiguratorStationCompatibilitySelection, ConfiguratorStationCompatibilityVariant,
    ConfiguratorStationLoadProfile, ConfiguratorStationUpdate, GymDetail, GymExerciseGroup,
    GymExerciseVariantSummary, GymLoadProfileSummary, GymStationAvailability, GymStationDetail,
    GymStationExerciseGroup, GymStationExerciseVariantSummary, GymStationOption, GymStationSummary,
    GymSummary, GymUpdate, NewConfiguratorStation, NewGym,
};
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

pub(super) async fn fetch_gym_summaries_for_user(
    repository: &DomainRepository,
    user_id: &str,
    favorite_gym_id: Option<&str>,
) -> Result<Vec<GymSummary>, PersistenceError> {
    let favorite_gym_id = favorite_gym_id.unwrap_or("");
    let rows = sqlx::query(
        "SELECT
            g.id::text AS id,
            g.name,
            g.status,
            COUNT(es.id)::bigint AS station_count,
            completion.last_visited_at
         FROM gyms g
         LEFT JOIN equipment_stations es
           ON es.gym_id = g.id
          AND es.user_id = $1::uuid
         LEFT JOIN LATERAL (
            SELECT MAX(w.completed_at)::text AS last_visited_at
            FROM workouts w
            WHERE w.gym_id = g.id
              AND w.user_id = $1::uuid
              AND w.completed_at IS NOT NULL
         ) completion ON TRUE
         WHERE g.user_id = $1::uuid
         GROUP BY g.id, g.name, g.status, completion.last_visited_at
         ORDER BY
            CASE WHEN $2 <> '' AND g.id::text = $2 THEN 0 ELSE 1 END ASC,
            lower(g.name) ASC,
            g.name ASC,
            g.id ASC",
    )
    .bind(user_id)
    .bind(favorite_gym_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| GymSummary {
            id: row.get("id"),
            name: row.get("name"),
            status: row.get("status"),
            station_count: row.get("station_count"),
            last_visited_at: row.get("last_visited_at"),
        })
        .collect())
}

pub(super) async fn fetch_configurator_station_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<Option<ConfiguratorStation>, PersistenceError> {
    let row = sqlx::query("SELECT es.id::text AS id, es.gym_id::text AS gym_id, es.name, es.status, lp.id::text AS load_profile_id, lp.name AS load_profile_name, lp.status AS load_profile_status FROM equipment_stations es JOIN gyms g ON g.id = es.gym_id AND g.user_id = $3::uuid JOIN load_profiles lp ON lp.id = es.load_profile_id AND lp.user_id = $3::uuid WHERE es.gym_id = $1::uuid AND es.id = $2::uuid AND es.user_id = $3::uuid")
        .bind(gym_id).bind(station_id).bind(user_id).fetch_optional(&repository.pool).await?;
    Ok(row.map(configurator_station_from_row))
}

pub(super) async fn fetch_configurator_stations_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<Option<Vec<ConfiguratorStation>>, PersistenceError> {
    let gym_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM gyms WHERE id = $1::uuid AND user_id = $2::uuid)",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_one(&repository.pool)
    .await?;
    if !gym_exists {
        return Ok(None);
    }

    let rows = sqlx::query("SELECT es.id::text AS id, es.gym_id::text AS gym_id, es.name, es.status, lp.id::text AS load_profile_id, lp.name AS load_profile_name, lp.status AS load_profile_status FROM equipment_stations es JOIN load_profiles lp ON lp.id = es.load_profile_id AND lp.user_id = $2::uuid WHERE es.gym_id = $1::uuid AND es.user_id = $2::uuid ORDER BY lower(es.name), es.name, es.id")
        .bind(gym_id).bind(user_id).fetch_all(&repository.pool).await?;
    Ok(Some(
        rows.into_iter()
            .map(configurator_station_from_row)
            .collect(),
    ))
}

pub(super) async fn station_name_exists_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
    name: &str,
    excluding_id: Option<&str>,
) -> Result<bool, PersistenceError> {
    sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM equipment_stations WHERE gym_id = $1::uuid AND user_id = $2::uuid AND name = $3 AND ($4::uuid IS NULL OR id <> $4::uuid))")
        .bind(gym_id).bind(user_id).bind(name).bind(excluding_id).fetch_one(&repository.pool).await.map_err(Into::into)
}

pub(super) async fn create_configurator_station_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
    station: &NewConfiguratorStation,
) -> Result<ConfiguratorStation, PersistenceError> {
    let id = Uuid::new_v4().to_string();
    let result = sqlx::query("INSERT INTO equipment_stations (id, gym_id, user_id, name, load_profile_id, status) SELECT $1::uuid, g.id, $3::uuid, $4, lp.id, 'new' FROM gyms g JOIN load_profiles lp ON lp.id = $5::uuid AND lp.user_id = $3::uuid AND lp.status <> 'inactive' WHERE g.id = $2::uuid AND g.user_id = $3::uuid")
        .bind(&id).bind(gym_id).bind(user_id).bind(&station.name).bind(&station.load_profile_id).execute(&repository.pool).await;
    match result {
        Ok(result) if result.rows_affected() == 0 => {
            return Err(PersistenceError::NotFound(
                "Gym or active load profile not found".to_owned(),
            ))
        }
        Ok(_) => {}
        Err(error) => return Err(map_station_write_sqlx_error(error)?),
    }
    fetch_configurator_station_for_user(repository, gym_id, &id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Station not found".to_owned()))
}

pub(super) async fn update_configurator_station_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
    update: &ConfiguratorStationUpdate,
) -> Result<ConfiguratorStation, PersistenceError> {
    let mut tx =
        logging::begin_transaction(&repository.pool, "update_configurator_station", "station")
            .await?;
    let row = sqlx::query("SELECT es.status, es.load_profile_id::text AS load_profile_id FROM equipment_stations es JOIN gyms g ON g.id = es.gym_id AND g.user_id = $3::uuid WHERE es.gym_id = $1::uuid AND es.id = $2::uuid AND es.user_id = $3::uuid FOR UPDATE")
        .bind(gym_id).bind(station_id).bind(user_id).fetch_optional(&mut *tx).await?;
    let Some(row) = row else {
        logging::rollback_transaction(tx, "update_configurator_station", "station").await;
        return Err(PersistenceError::NotFound("Station not found".to_owned()));
    };
    let status: String = row.get("status");
    let current_profile: String = row.get("load_profile_id");
    if status != "new"
        && update
            .load_profile_id
            .as_deref()
            .is_some_and(|id| id != current_profile)
    {
        logging::rollback_transaction(tx, "update_configurator_station", "station").await;
        return Err(PersistenceError::Conflict(
            "Only draft stations can change load profile".to_owned(),
        ));
    }
    if let Some(profile_id) = update
        .load_profile_id
        .as_deref()
        .filter(|id| *id != current_profile)
    {
        let usable: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM load_profiles WHERE id = $1::uuid AND user_id = $2::uuid AND status <> 'inactive')").bind(profile_id).bind(user_id).fetch_one(&mut *tx).await?;
        if !usable {
            logging::rollback_transaction(tx, "update_configurator_station", "station").await;
            return Err(PersistenceError::NotFound(
                "Active load profile not found".to_owned(),
            ));
        }
    }
    let profile_id = update
        .load_profile_id
        .as_deref()
        .unwrap_or(&current_profile);
    match sqlx::query("UPDATE equipment_stations SET name = $4, load_profile_id = $5::uuid WHERE gym_id = $1::uuid AND id = $2::uuid AND user_id = $3::uuid").bind(gym_id).bind(station_id).bind(user_id).bind(&update.name).bind(profile_id).execute(&mut *tx).await {
        Ok(_) => {},
        Err(error) => return Err(map_station_write_sqlx_error(error)?),
    }
    logging::commit_transaction(tx, "update_configurator_station", "station").await?;
    fetch_configurator_station_for_user(repository, gym_id, station_id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Station not found".to_owned()))
}

pub(super) async fn delete_configurator_station_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let result = sqlx::query("DELETE FROM equipment_stations WHERE gym_id = $1::uuid AND id = $2::uuid AND user_id = $3::uuid AND status = 'new'").bind(gym_id).bind(station_id).bind(user_id).execute(&repository.pool).await?;
    if result.rows_affected() == 1 {
        Ok(())
    } else if fetch_configurator_station_for_user(repository, gym_id, station_id, user_id)
        .await?
        .is_some()
    {
        Err(PersistenceError::Conflict(
            "Only draft stations can be deleted".to_owned(),
        ))
    } else {
        Err(PersistenceError::NotFound("Station not found".to_owned()))
    }
}

pub(super) async fn fetch_configurator_station_compatibilities_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<Option<ConfiguratorStationCompatibilitySelection>, PersistenceError> {
    let station_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1
            FROM equipment_stations es
            JOIN gyms g ON g.id = es.gym_id AND g.user_id = $3::uuid
            WHERE es.gym_id = $1::uuid AND es.id = $2::uuid AND es.user_id = $3::uuid
        )",
    )
    .bind(gym_id)
    .bind(station_id)
    .bind(user_id)
    .fetch_one(&repository.pool)
    .await?;
    if !station_exists {
        return Ok(None);
    }

    let enabled_variants = fetch_configurator_station_compatibility_variants(
        &repository.pool,
        gym_id,
        station_id,
        user_id,
        true,
    )
    .await?;
    let eligible_variants = fetch_configurator_station_compatibility_variants(
        &repository.pool,
        gym_id,
        station_id,
        user_id,
        false,
    )
    .await?;
    Ok(Some(ConfiguratorStationCompatibilitySelection {
        gym_id: gym_id.to_owned(),
        station_id: station_id.to_owned(),
        enabled_variants,
        eligible_variants,
    }))
}

pub(super) async fn reconcile_configurator_station_compatibilities_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
    variant_ids: &[Uuid],
) -> Result<(), PersistenceError> {
    let mut tx = logging::begin_transaction(
        &repository.pool,
        "reconcile_configurator_station_compatibilities",
        "station_compatibility",
    )
    .await?;
    let station = sqlx::query(
        "SELECT es.id
         FROM equipment_stations es
         JOIN gyms g ON g.id = es.gym_id AND g.user_id = $3::uuid
         WHERE es.gym_id = $1::uuid AND es.id = $2::uuid AND es.user_id = $3::uuid
         FOR UPDATE",
    )
    .bind(gym_id)
    .bind(station_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;
    if station.is_none() {
        logging::rollback_transaction(
            tx,
            "reconcile_configurator_station_compatibilities",
            "station_compatibility",
        )
        .await;
        return Err(PersistenceError::NotFound("Station not found".to_owned()));
    }

    let eligible_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM exercise_variants ev
         JOIN exercises e ON e.id = ev.exercise_id AND e.user_id = $2::uuid
         WHERE ev.id = ANY($1::uuid[])
           AND ev.user_id = $2::uuid
           AND ev.requires_station = TRUE",
    )
    .bind(variant_ids)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;
    if eligible_count != variant_ids.len() as i64 {
        logging::rollback_transaction(
            tx,
            "reconcile_configurator_station_compatibilities",
            "station_compatibility",
        )
        .await;
        return Err(PersistenceError::Conflict(
            "One or more exercise variants are not eligible for this station selection".to_owned(),
        ));
    }

    sqlx::query(
        "UPDATE exercise_variant_equipment_compatibilities
         SET is_enabled = FALSE
         WHERE equipment_station_id = $1::uuid
           AND user_id = $2::uuid
           AND NOT (exercise_variant_id = ANY($3::uuid[]))",
    )
    .bind(station_id)
    .bind(user_id)
    .bind(variant_ids)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO exercise_variant_equipment_compatibilities (
             exercise_variant_id, equipment_station_id, user_id, is_enabled
         )
         SELECT variant_id, $2::uuid, $3::uuid, TRUE
         FROM unnest($1::uuid[]) AS variant_id
         ON CONFLICT (exercise_variant_id, equipment_station_id)
         DO UPDATE SET is_enabled = TRUE",
    )
    .bind(variant_ids)
    .bind(station_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;
    logging::commit_transaction(
        tx,
        "reconcile_configurator_station_compatibilities",
        "station_compatibility",
    )
    .await
}

pub(super) async fn fetch_configurator_exercise_variant_compatibilities_for_user(
    repository: &DomainRepository,
    exercise_id: &str,
    variant_id: &str,
    user_id: &str,
) -> Result<Option<ConfiguratorExerciseVariantCompatibilitySelection>, PersistenceError> {
    let variant_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM exercise_variants ev JOIN exercises e ON e.id = ev.exercise_id AND e.user_id = $3::uuid WHERE ev.id = $2::uuid AND ev.exercise_id = $1::uuid AND ev.user_id = $3::uuid AND ev.requires_station = TRUE)",
    )
    .bind(exercise_id)
    .bind(variant_id)
    .bind(user_id)
    .fetch_one(&repository.pool)
    .await?;
    if !variant_exists {
        return Ok(None);
    }

    let enabled_stations = fetch_configurator_exercise_variant_compatibility_stations(
        &repository.pool,
        variant_id,
        user_id,
        true,
    )
    .await?;
    let eligible_stations = fetch_configurator_exercise_variant_compatibility_stations(
        &repository.pool,
        variant_id,
        user_id,
        false,
    )
    .await?;
    Ok(Some(ConfiguratorExerciseVariantCompatibilitySelection {
        exercise_id: exercise_id.to_owned(),
        variant_id: variant_id.to_owned(),
        enabled_stations,
        eligible_stations,
    }))
}

pub(super) async fn reconcile_configurator_exercise_variant_compatibilities_for_user(
    repository: &DomainRepository,
    exercise_id: &str,
    variant_id: &str,
    user_id: &str,
    station_ids: &[Uuid],
) -> Result<(), PersistenceError> {
    let mut tx = logging::begin_transaction(
        &repository.pool,
        "reconcile_configurator_exercise_variant_compatibilities",
        "exercise_variant_compatibility",
    )
    .await?;
    let variant = sqlx::query(
        "SELECT ev.id, ev.requires_station FROM exercise_variants ev JOIN exercises e ON e.id = ev.exercise_id AND e.user_id = $3::uuid WHERE ev.id = $2::uuid AND ev.exercise_id = $1::uuid AND ev.user_id = $3::uuid FOR UPDATE",
    )
    .bind(exercise_id)
    .bind(variant_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(variant) = variant else {
        logging::rollback_transaction(
            tx,
            "reconcile_configurator_exercise_variant_compatibilities",
            "exercise_variant_compatibility",
        )
        .await;
        return Err(PersistenceError::NotFound(
            "Exercise variant not found".to_owned(),
        ));
    };
    if !variant.get::<bool, _>("requires_station") {
        logging::rollback_transaction(
            tx,
            "reconcile_configurator_exercise_variant_compatibilities",
            "exercise_variant_compatibility",
        )
        .await;
        return Err(PersistenceError::Conflict(
            "Exercise variant does not require a station".to_owned(),
        ));
    }
    let eligible_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM equipment_stations es JOIN gyms g ON g.id = es.gym_id AND g.user_id = $2::uuid WHERE es.id = ANY($1::uuid[]) AND es.user_id = $2::uuid",
    )
    .bind(station_ids)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;
    if eligible_count != station_ids.len() as i64 {
        logging::rollback_transaction(
            tx,
            "reconcile_configurator_exercise_variant_compatibilities",
            "exercise_variant_compatibility",
        )
        .await;
        return Err(PersistenceError::Conflict(
            "One or more stations are not eligible for this exercise variant selection".to_owned(),
        ));
    }
    sqlx::query(
        "UPDATE exercise_variant_equipment_compatibilities SET is_enabled = FALSE WHERE exercise_variant_id = $1::uuid AND user_id = $2::uuid AND NOT (equipment_station_id = ANY($3::uuid[]))",
    )
    .bind(variant_id)
    .bind(user_id)
    .bind(station_ids)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO exercise_variant_equipment_compatibilities (exercise_variant_id, equipment_station_id, user_id, is_enabled) SELECT $2::uuid, station_id, $3::uuid, TRUE FROM unnest($1::uuid[]) AS station_id ON CONFLICT (exercise_variant_id, equipment_station_id) DO UPDATE SET is_enabled = TRUE",
    )
    .bind(station_ids)
    .bind(variant_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;
    logging::commit_transaction(
        tx,
        "reconcile_configurator_exercise_variant_compatibilities",
        "exercise_variant_compatibility",
    )
    .await
}

async fn fetch_configurator_exercise_variant_compatibility_stations(
    pool: &sqlx::PgPool,
    variant_id: &str,
    user_id: &str,
    enabled_only: bool,
) -> Result<Vec<ConfiguratorExerciseVariantCompatibilityStation>, PersistenceError> {
    let rows = if enabled_only {
        sqlx::query(
            "SELECT g.id::text AS gym_id, g.name AS gym_name, es.id::text AS station_id, es.name AS station_name FROM exercise_variant_equipment_compatibilities evec JOIN equipment_stations es ON es.id = evec.equipment_station_id AND es.user_id = $2::uuid JOIN gyms g ON g.id = es.gym_id AND g.user_id = $2::uuid WHERE evec.exercise_variant_id = $1::uuid AND evec.user_id = $2::uuid AND evec.is_enabled = TRUE ORDER BY lower(g.name), g.name, g.id, lower(es.name), es.name, es.id",
        )
        .bind(variant_id)
        .bind(user_id)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query(
            "SELECT g.id::text AS gym_id, g.name AS gym_name, es.id::text AS station_id, es.name AS station_name FROM equipment_stations es JOIN gyms g ON g.id = es.gym_id AND g.user_id = $1::uuid WHERE es.user_id = $1::uuid ORDER BY lower(g.name), g.name, g.id, lower(es.name), es.name, es.id",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?
    };
    Ok(rows
        .into_iter()
        .map(|row| ConfiguratorExerciseVariantCompatibilityStation {
            gym_id: row.get("gym_id"),
            gym_name: row.get("gym_name"),
            station_id: row.get("station_id"),
            station_name: row.get("station_name"),
        })
        .collect())
}

async fn fetch_configurator_station_compatibility_variants(
    pool: &sqlx::PgPool,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
    enabled_only: bool,
) -> Result<Vec<ConfiguratorStationCompatibilityVariant>, PersistenceError> {
    let rows = if enabled_only {
        sqlx::query(
            "SELECT e.id::text AS exercise_id, e.name AS exercise_name,
                    ev.id::text AS variant_id, ev.name AS variant_name,
                    ev.repetition_kind, ev.load_input_mode, ev.set_tracking_mode
             FROM exercise_variant_equipment_compatibilities evec
             JOIN exercise_variants ev ON ev.id = evec.exercise_variant_id
                AND ev.user_id = $3::uuid AND ev.requires_station = TRUE
             JOIN exercises e ON e.id = ev.exercise_id AND e.user_id = $3::uuid
             JOIN equipment_stations es ON es.id = evec.equipment_station_id
                AND es.user_id = $3::uuid AND es.gym_id = $1::uuid
             WHERE evec.equipment_station_id = $2::uuid
                AND evec.user_id = $3::uuid AND evec.is_enabled = TRUE
             ORDER BY lower(e.name), e.name, e.id, lower(ev.name), ev.name, ev.id",
        )
        .bind(gym_id)
        .bind(station_id)
        .bind(user_id)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query(
            "SELECT e.id::text AS exercise_id, e.name AS exercise_name,
                    ev.id::text AS variant_id, ev.name AS variant_name,
                    ev.repetition_kind, ev.load_input_mode, ev.set_tracking_mode
             FROM exercise_variants ev
             JOIN exercises e ON e.id = ev.exercise_id AND e.user_id = $1::uuid
             WHERE ev.user_id = $1::uuid AND ev.requires_station = TRUE
             ORDER BY lower(e.name), e.name, e.id, lower(ev.name), ev.name, ev.id",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?
    };
    Ok(rows
        .into_iter()
        .map(|row| ConfiguratorStationCompatibilityVariant {
            exercise_id: row.get("exercise_id"),
            exercise_name: row.get("exercise_name"),
            variant_id: row.get("variant_id"),
            variant_name: row.get("variant_name"),
            repetition_kind: row.get("repetition_kind"),
            load_input_mode: row.get("load_input_mode"),
            set_tracking_mode: row.get("set_tracking_mode"),
        })
        .collect())
}

fn configurator_station_from_row(row: PgRow) -> ConfiguratorStation {
    ConfiguratorStation {
        id: row.get("id"),
        gym_id: row.get("gym_id"),
        name: row.get("name"),
        status: row.get("status"),
        load_profile: ConfiguratorStationLoadProfile {
            id: row.get("load_profile_id"),
            name: row.get("load_profile_name"),
            status: row.get("load_profile_status"),
        },
    }
}

fn map_station_write_sqlx_error(error: sqlx::Error) -> Result<PersistenceError, PersistenceError> {
    if let sqlx::Error::Database(db_error) = &error {
        if db_error.code().as_deref() == Some("23505") {
            return Ok(PersistenceError::Conflict(
                "Station name already exists in this gym".to_owned(),
            ));
        }
    }
    Err(PersistenceError::Sqlx(error))
}

pub(super) async fn gym_name_exists_for_user(
    repository: &DomainRepository,
    user_id: &str,
    name: &str,
    excluding_id: Option<&str>,
) -> Result<bool, PersistenceError> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1
            FROM gyms
            WHERE user_id = $1::uuid
              AND lower(btrim(name)) = lower(btrim($2))
              AND ($3::uuid IS NULL OR id <> $3::uuid)
        )",
    )
    .bind(user_id)
    .bind(name)
    .bind(excluding_id)
    .fetch_one(&repository.pool)
    .await
    .map_err(Into::into)
}

pub(super) async fn create_gym_for_user(
    repository: &DomainRepository,
    user_id: &str,
    new_gym: &NewGym,
) -> Result<GymSummary, PersistenceError> {
    let id = Uuid::new_v4().to_string();

    match sqlx::query(
        "INSERT INTO gyms (id, user_id, name, status)
         VALUES ($1::uuid, $2::uuid, $3, 'new')",
    )
    .bind(&id)
    .bind(user_id)
    .bind(&new_gym.name)
    .execute(&repository.pool)
    .await
    {
        Ok(_) => {}
        Err(error) => return Err(map_gym_write_sqlx_error(error)?),
    }

    fetch_gym_summary_for_user(repository, &id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Gym not found".to_owned()))
}

pub(super) async fn update_gym_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
    update: &GymUpdate,
) -> Result<GymSummary, PersistenceError> {
    match sqlx::query(
        "UPDATE gyms
         SET name = $3
         WHERE id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(gym_id)
    .bind(user_id)
    .bind(&update.name)
    .execute(&repository.pool)
    .await
    {
        Ok(result) if result.rows_affected() == 0 => {
            return Err(PersistenceError::NotFound("Gym not found".to_owned()));
        }
        Ok(_) => {}
        Err(error) => return Err(map_gym_write_sqlx_error(error)?),
    }

    fetch_gym_summary_for_user(repository, gym_id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Gym not found".to_owned()))
}

pub(super) async fn delete_gym_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let mut tx = logging::begin_transaction(&repository.pool, "delete_gym", "gym").await?;
    let status = sqlx::query_scalar::<_, String>(
        "SELECT status
         FROM gyms
         WHERE id = $1::uuid
           AND user_id = $2::uuid
         FOR UPDATE",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(status) = status else {
        logging::rollback_transaction(tx, "delete_gym", "gym").await;
        return Err(PersistenceError::NotFound("Gym not found".to_owned()));
    };

    if status != "new" {
        logging::rollback_transaction(tx, "delete_gym", "gym").await;
        return Err(PersistenceError::Conflict(
            "Only draft gyms can be deleted".to_owned(),
        ));
    }

    sqlx::query(
        "DELETE FROM gyms
         WHERE id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(gym_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    logging::commit_transaction(tx, "delete_gym", "gym").await
}

pub(super) async fn favorite_gym_exists_for_user(
    repository: &DomainRepository,
    user_id: &str,
    gym_id: &str,
) -> Result<bool, PersistenceError> {
    let row = sqlx::query(
        "SELECT EXISTS (
            SELECT 1
            FROM gyms g
            WHERE g.id = $1::uuid
              AND g.user_id = $2::uuid
         ) AS exists",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_one(&repository.pool)
    .await?;

    Ok(row.get("exists"))
}

pub(super) async fn fetch_gym_detail_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<Option<GymDetail>, PersistenceError> {
    let maybe_gym = sqlx::query(
        "SELECT
            g.id::text AS id,
            g.name,
            g.status,
            COUNT(es.id)::bigint AS station_count,
            completion.last_visited_at
         FROM gyms g
         LEFT JOIN equipment_stations es
           ON es.gym_id = g.id
          AND es.user_id = $2::uuid
         LEFT JOIN LATERAL (
            SELECT MAX(w.completed_at)::text AS last_visited_at
            FROM workouts w
            WHERE w.gym_id = g.id
              AND w.user_id = $2::uuid
              AND w.completed_at IS NOT NULL
         ) completion ON TRUE
         WHERE g.id = $1::uuid
           AND g.user_id = $2::uuid
         GROUP BY g.id, g.name, g.status, completion.last_visited_at",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(gym) = maybe_gym else {
        return Ok(None);
    };

    let stations = fetch_gym_station_summaries(repository, gym_id, user_id).await?;
    let exercise_rows = fetch_gym_exercise_variant_rows(repository, gym_id, user_id).await?;

    Ok(Some(GymDetail {
        id: gym.get("id"),
        name: gym.get("name"),
        status: gym.get("status"),
        station_count: gym.get("station_count"),
        last_visited_at: gym.get("last_visited_at"),
        stations,
        exercise_groups: group_gym_exercise_rows(exercise_rows),
    }))
}

async fn fetch_gym_summary_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<Option<GymSummary>, PersistenceError> {
    let row = sqlx::query(
        "SELECT
            g.id::text AS id,
            g.name,
            g.status,
            COUNT(es.id)::bigint AS station_count,
            completion.last_visited_at
         FROM gyms g
         LEFT JOIN equipment_stations es
           ON es.gym_id = g.id
          AND es.user_id = $2::uuid
         LEFT JOIN LATERAL (
            SELECT MAX(w.completed_at)::text AS last_visited_at
            FROM workouts w
            WHERE w.gym_id = g.id
              AND w.user_id = $2::uuid
              AND w.completed_at IS NOT NULL
         ) completion ON TRUE
         WHERE g.id = $1::uuid
           AND g.user_id = $2::uuid
         GROUP BY g.id, g.name, g.status, completion.last_visited_at",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| GymSummary {
        id: row.get("id"),
        name: row.get("name"),
        status: row.get("status"),
        station_count: row.get("station_count"),
        last_visited_at: row.get("last_visited_at"),
    }))
}

fn map_gym_write_sqlx_error(error: sqlx::Error) -> Result<PersistenceError, PersistenceError> {
    if let sqlx::Error::Database(db_error) = &error {
        if db_error.code().as_deref() == Some("23505") {
            return Ok(PersistenceError::Conflict(
                "Gym name already exists".to_owned(),
            ));
        }
    }

    Err(PersistenceError::Sqlx(error))
}

pub(super) async fn fetch_gym_station_detail_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<Option<GymStationDetail>, PersistenceError> {
    let maybe_station = sqlx::query(
        "SELECT
            g.id::text AS gym_id,
            g.name AS gym_name,
            es.id::text AS station_id,
            es.name AS station_name,
            lp.id::text AS load_profile_id,
            lp.name AS load_profile_name,
            lp.weight_unit AS load_profile_weight_unit,
            lp.definition AS load_profile_definition,
            lp.definition->>'kind' AS load_profile_definition_kind
         FROM equipment_stations es
         JOIN gyms g
           ON g.id = es.gym_id
          AND g.user_id = $3::uuid
         JOIN load_profiles lp
           ON lp.id = es.load_profile_id
          AND lp.user_id = $3::uuid
         WHERE es.gym_id = $1::uuid
           AND es.id = $2::uuid
           AND es.user_id = $3::uuid",
    )
    .bind(gym_id)
    .bind(station_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(station) = maybe_station else {
        return Ok(None);
    };

    let definition: sqlx::types::JsonValue = station.get("load_profile_definition");
    let weight_unit: String = station.get("load_profile_weight_unit");
    let definition_kind = station
        .get::<Option<String>, _>("load_profile_definition_kind")
        .ok_or_else(|| {
            PersistenceError::Conflict(
                "load profile definition is missing kind for station detail".to_string(),
            )
        })?;
    let max_load_kg = repository
        .fetch_max_load_kg_preference_for_user(user_id)
        .await?;
    let possible_loads_kg = DomainRepository::load_profile_definition_to_kg_capped(
        &definition,
        &weight_unit,
        max_load_kg,
    )?;
    let variant_rows =
        fetch_gym_station_exercise_variant_rows(repository, gym_id, station_id, user_id).await?;

    Ok(Some(GymStationDetail {
        gym_id: station.get("gym_id"),
        gym_name: station.get("gym_name"),
        station_id: station.get("station_id"),
        station_name: station.get("station_name"),
        load_profile: GymLoadProfileSummary {
            id: station.get("load_profile_id"),
            name: station.get("load_profile_name"),
            weight_unit,
            definition_kind,
            possible_loads_kg,
        },
        suitable_variant_groups: group_gym_station_exercise_rows(variant_rows),
    }))
}

async fn fetch_gym_station_summaries(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<Vec<GymStationSummary>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            es.id::text AS id,
            es.name,
            lp.name AS load_profile_name,
            COUNT(DISTINCT ev.id)::bigint AS suitable_variant_count
         FROM equipment_stations es
         JOIN load_profiles lp
           ON lp.id = es.load_profile_id
          AND lp.user_id = $2::uuid
         LEFT JOIN exercise_variant_equipment_compatibilities evec
           ON evec.equipment_station_id = es.id
          AND evec.user_id = $2::uuid
          AND evec.is_enabled = TRUE
         LEFT JOIN exercise_variants ev
           ON ev.id = evec.exercise_variant_id
          AND ev.user_id = $2::uuid
          AND ev.requires_station = TRUE
         WHERE es.gym_id = $1::uuid
           AND es.user_id = $2::uuid
         GROUP BY es.id, es.name, lp.name
         ORDER BY lower(es.name) ASC, es.name ASC, es.id ASC",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| GymStationSummary {
            id: row.get("id"),
            name: row.get("name"),
            load_profile_name: row.get("load_profile_name"),
            suitable_variant_count: row.get("suitable_variant_count"),
        })
        .collect())
}

async fn fetch_gym_exercise_variant_rows(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<Vec<PgRow>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            e.id::text AS exercise_id,
            e.name AS exercise_name,
            ev.id::text AS variant_id,
            ev.name AS variant_name,
            ev.requires_station,
            ev.repetition_kind,
            ev.load_input_mode,
            ev.set_tracking_mode,
            es.id::text AS station_id,
            es.name AS station_name
         FROM exercise_variants ev
         JOIN exercises e
           ON e.id = ev.exercise_id
          AND e.user_id = $2::uuid
         LEFT JOIN exercise_variant_equipment_compatibilities evec
           ON ev.requires_station = TRUE
          AND evec.exercise_variant_id = ev.id
          AND evec.user_id = $2::uuid
          AND evec.is_enabled = TRUE
         LEFT JOIN equipment_stations es
           ON es.id = evec.equipment_station_id
          AND es.user_id = $2::uuid
          AND es.gym_id = $1::uuid
         WHERE ev.user_id = $2::uuid
           AND (ev.requires_station = FALSE OR es.id IS NOT NULL)
         ORDER BY
            lower(e.name) ASC,
            e.name ASC,
            e.id ASC,
            lower(ev.name) ASC,
            ev.name ASC,
            ev.id ASC,
            lower(es.name) ASC NULLS FIRST,
            es.name ASC NULLS FIRST,
            es.id ASC NULLS FIRST",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows)
}

async fn fetch_gym_station_exercise_variant_rows(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<Vec<PgRow>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            e.id::text AS exercise_id,
            e.name AS exercise_name,
            ev.id::text AS variant_id,
            ev.name AS variant_name,
            ev.repetition_kind,
            ev.load_input_mode,
            ev.set_tracking_mode
         FROM exercise_variant_equipment_compatibilities evec
         JOIN exercise_variants ev
           ON ev.id = evec.exercise_variant_id
          AND ev.user_id = $3::uuid
          AND ev.requires_station = TRUE
         JOIN exercises e
           ON e.id = ev.exercise_id
          AND e.user_id = $3::uuid
         JOIN equipment_stations es
           ON es.id = evec.equipment_station_id
          AND es.user_id = $3::uuid
          AND es.gym_id = $1::uuid
         WHERE evec.equipment_station_id = $2::uuid
           AND evec.user_id = $3::uuid
           AND evec.is_enabled = TRUE
         ORDER BY
            lower(e.name) ASC,
            e.name ASC,
            e.id ASC,
            lower(ev.name) ASC,
            ev.name ASC,
            ev.id ASC",
    )
    .bind(gym_id)
    .bind(station_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows)
}

fn group_gym_exercise_rows(rows: Vec<PgRow>) -> Vec<GymExerciseGroup> {
    let mut groups: Vec<GymExerciseGroup> = Vec::new();

    for row in rows {
        let exercise_id: String = row.get("exercise_id");
        let exercise_name: String = row.get("exercise_name");
        let variant_id: String = row.get("variant_id");
        let variant_name: String = row.get("variant_name");
        let requires_station: bool = row.get("requires_station");

        if groups
            .last()
            .is_none_or(|group| group.exercise_id != exercise_id)
        {
            groups.push(GymExerciseGroup {
                exercise_id: exercise_id.clone(),
                exercise_name,
                variants: Vec::new(),
            });
        }

        let group = groups.last_mut().expect("group should exist");
        if group
            .variants
            .last()
            .is_none_or(|variant| variant.variant_id != variant_id)
        {
            group.variants.push(GymExerciseVariantSummary {
                variant_id: variant_id.clone(),
                variant_name,
                requires_station,
                station_availability: GymStationAvailability::Stationless,
                repetition_kind: row.get("repetition_kind"),
                load_input_mode: row.get("load_input_mode"),
                set_tracking_mode: row.get("set_tracking_mode"),
                station_options: Vec::new(),
            });
        }

        if let Some(station_id) = row.get::<Option<String>, _>("station_id") {
            let station_name = row
                .get::<Option<String>, _>("station_name")
                .expect("station rows should include station_name");
            group
                .variants
                .last_mut()
                .expect("variant should exist")
                .station_options
                .push(GymStationOption {
                    station_id,
                    station_name,
                    station_profile_loads_kg: Vec::new(),
                });
        }
    }

    for group in &mut groups {
        for variant in &mut group.variants {
            variant.station_availability = if variant.requires_station {
                match variant.station_options.len() {
                    1 => GymStationAvailability::SingleStation,
                    _ => GymStationAvailability::MultiStation,
                }
            } else {
                GymStationAvailability::Stationless
            };
        }
    }

    groups
}

fn group_gym_station_exercise_rows(rows: Vec<PgRow>) -> Vec<GymStationExerciseGroup> {
    let mut groups: Vec<GymStationExerciseGroup> = Vec::new();

    for row in rows {
        let exercise_id: String = row.get("exercise_id");
        let exercise_name: String = row.get("exercise_name");

        if groups
            .last()
            .is_none_or(|group| group.exercise_id != exercise_id)
        {
            groups.push(GymStationExerciseGroup {
                exercise_id: exercise_id.clone(),
                exercise_name,
                variants: Vec::new(),
            });
        }

        groups
            .last_mut()
            .expect("group should exist")
            .variants
            .push(GymStationExerciseVariantSummary {
                variant_id: row.get("variant_id"),
                variant_name: row.get("variant_name"),
                repetition_kind: row.get("repetition_kind"),
                load_input_mode: row.get("load_input_mode"),
                set_tracking_mode: row.get("set_tracking_mode"),
            });
    }

    groups
}
