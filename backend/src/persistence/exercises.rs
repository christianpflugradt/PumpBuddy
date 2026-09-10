use super::{DomainRepository, ExerciseRepository, PersistenceError};
use crate::domain::{
    ExerciseSummary, ExerciseUpdate, ExerciseVariant, ExerciseVariantUpdate, NewExercise,
    NewExerciseVariant,
};
use sqlx::Row;
use uuid::Uuid;

fn summary(row: sqlx::postgres::PgRow) -> ExerciseSummary {
    ExerciseSummary {
        id: row.get("id"),
        name: row.get("name"),
        status: row.get("status"),
        variant_count: row.get("variant_count"),
    }
}
fn variant(row: sqlx::postgres::PgRow) -> ExerciseVariant {
    ExerciseVariant {
        id: row.get("id"),
        exercise_id: row.get("exercise_id"),
        name: row.get("name"),
        status: row.get("status"),
        requires_station: row.get("requires_station"),
        load_input_mode: row.get("load_input_mode"),
        set_tracking_mode: row.get("set_tracking_mode"),
        repetition_kind: row.get("repetition_kind"),
    }
}

async fn exercise(
    repository: &DomainRepository,
    id: &str,
    user: &str,
) -> Result<Option<ExerciseSummary>, PersistenceError> {
    sqlx::query("SELECT e.id::text id,e.name,e.status,COUNT(v.id)::bigint variant_count FROM exercises e LEFT JOIN exercise_variants v ON v.exercise_id=e.id AND v.user_id=$2::uuid WHERE e.id=$1::uuid AND e.user_id=$2::uuid GROUP BY e.id,e.name,e.status")
        .bind(id).bind(user).fetch_optional(&repository.pool).await.map(|row| row.map(summary)).map_err(Into::into)
}
async fn exercise_variant(
    repository: &DomainRepository,
    exercise_id: &str,
    variant_id: &str,
    user: &str,
) -> Result<Option<ExerciseVariant>, PersistenceError> {
    sqlx::query("SELECT id::text id,exercise_id::text exercise_id,name,status,requires_station,load_input_mode,set_tracking_mode,repetition_kind FROM exercise_variants WHERE exercise_id=$1::uuid AND id=$2::uuid AND user_id=$3::uuid")
        .bind(exercise_id).bind(variant_id).bind(user).fetch_optional(&repository.pool).await.map(|row| row.map(variant)).map_err(Into::into)
}

impl ExerciseRepository for DomainRepository {
    async fn fetch_exercise_summaries_for_user(
        &self,
        user: &str,
    ) -> Result<Vec<ExerciseSummary>, PersistenceError> {
        sqlx::query("SELECT e.id::text id,e.name,e.status,COUNT(v.id)::bigint variant_count FROM exercises e LEFT JOIN exercise_variants v ON v.exercise_id=e.id AND v.user_id=$1::uuid WHERE e.user_id=$1::uuid GROUP BY e.id,e.name,e.status ORDER BY lower(e.name),e.name,e.id")
            .bind(user).fetch_all(&self.pool).await.map(|rows| rows.into_iter().map(summary).collect()).map_err(Into::into)
    }
    async fn fetch_exercise_for_user(
        &self,
        id: &str,
        user: &str,
    ) -> Result<Option<ExerciseSummary>, PersistenceError> {
        exercise(self, id, user).await
    }
    async fn create_exercise_for_user(
        &self,
        user: &str,
        input: &NewExercise,
    ) -> Result<ExerciseSummary, PersistenceError> {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO exercises (id,user_id,name,status) VALUES ($1::uuid,$2::uuid,$3,'new')",
        )
        .bind(&id)
        .bind(user)
        .bind(&input.name)
        .execute(&self.pool)
        .await
        .map_err(map_write)?;
        exercise(self, &id, user)
            .await?
            .ok_or_else(|| PersistenceError::NotFound("Exercise not found".into()))
    }
    async fn update_exercise_for_user(
        &self,
        id: &str,
        user: &str,
        input: &ExerciseUpdate,
    ) -> Result<ExerciseSummary, PersistenceError> {
        let r = sqlx::query("UPDATE exercises SET name=$3 WHERE id=$1::uuid AND user_id=$2::uuid")
            .bind(id)
            .bind(user)
            .bind(&input.name)
            .execute(&self.pool)
            .await
            .map_err(map_write)?;
        if r.rows_affected() == 0 {
            return Err(PersistenceError::NotFound("Exercise not found".into()));
        };
        exercise(self, id, user)
            .await?
            .ok_or_else(|| PersistenceError::NotFound("Exercise not found".into()))
    }
    async fn delete_exercise_for_user(&self, id: &str, user: &str) -> Result<(), PersistenceError> {
        let r = sqlx::query(
            "DELETE FROM exercises WHERE id=$1::uuid AND user_id=$2::uuid AND status='new'",
        )
        .bind(id)
        .bind(user)
        .execute(&self.pool)
        .await
        .map_err(map_write)?;
        if r.rows_affected() == 1 {
            return Ok(());
        };
        if exercise(self, id, user).await?.is_some() {
            Err(PersistenceError::Conflict(
                "Only draft exercises can be deleted".into(),
            ))
        } else {
            Err(PersistenceError::NotFound("Exercise not found".into()))
        }
    }
    async fn fetch_exercise_variants_for_user(
        &self,
        eid: &str,
        user: &str,
    ) -> Result<Option<Vec<ExerciseVariant>>, PersistenceError> {
        if exercise(self, eid, user).await?.is_none() {
            return Ok(None);
        };
        sqlx::query("SELECT id::text id,exercise_id::text exercise_id,name,status,requires_station,load_input_mode,set_tracking_mode,repetition_kind FROM exercise_variants WHERE exercise_id=$1::uuid AND user_id=$2::uuid ORDER BY lower(name),name,id").bind(eid).bind(user).fetch_all(&self.pool).await.map(|rows|Some(rows.into_iter().map(variant).collect())).map_err(Into::into)
    }
    async fn fetch_exercise_variant_for_user(
        &self,
        e: &str,
        v: &str,
        u: &str,
    ) -> Result<Option<ExerciseVariant>, PersistenceError> {
        exercise_variant(self, e, v, u).await
    }
    async fn create_exercise_variant_for_user(
        &self,
        e: &str,
        u: &str,
        input: &NewExerciseVariant,
    ) -> Result<ExerciseVariant, PersistenceError> {
        let id = Uuid::new_v4().to_string();
        let r=sqlx::query("INSERT INTO exercise_variants (id,exercise_id,user_id,name,status,requires_station,load_input_mode,set_tracking_mode,repetition_kind) SELECT $1::uuid,id,$3::uuid,$4,'new',$5,$6,$7,$8 FROM exercises WHERE id=$2::uuid AND user_id=$3::uuid").bind(&id).bind(e).bind(u).bind(&input.name).bind(input.requires_station).bind(&input.load_input_mode).bind(&input.set_tracking_mode).bind(&input.repetition_kind).execute(&self.pool).await.map_err(map_write)?;
        if r.rows_affected() == 0 {
            return Err(PersistenceError::NotFound("Exercise not found".into()));
        };
        exercise_variant(self, e, &id, u)
            .await?
            .ok_or_else(|| PersistenceError::NotFound("Exercise variant not found".into()))
    }
    async fn update_exercise_variant_for_user(
        &self,
        e: &str,
        v: &str,
        u: &str,
        input: &ExerciseVariantUpdate,
    ) -> Result<ExerciseVariant, PersistenceError> {
        let Some(current) = exercise_variant(self, e, v, u).await? else {
            return Err(PersistenceError::NotFound(
                "Exercise variant not found".into(),
            ));
        };
        let structural = input.requires_station.is_some()
            || input.load_input_mode.is_some()
            || input.set_tracking_mode.is_some()
            || input.repetition_kind.is_some();
        if structural && current.status != "new" {
            return Err(PersistenceError::Conflict(
                "Only draft variants can change structural fields".into(),
            ));
        };
        sqlx::query("UPDATE exercise_variants SET name=$4,requires_station=$5,load_input_mode=$6,set_tracking_mode=$7,repetition_kind=$8 WHERE exercise_id=$1::uuid AND id=$2::uuid AND user_id=$3::uuid").bind(e).bind(v).bind(u).bind(&input.name).bind(input.requires_station.unwrap_or(current.requires_station)).bind(input.load_input_mode.clone().unwrap_or(current.load_input_mode)).bind(input.set_tracking_mode.clone().unwrap_or(current.set_tracking_mode)).bind(input.repetition_kind.clone().unwrap_or(current.repetition_kind)).execute(&self.pool).await.map_err(map_write)?;
        exercise_variant(self, e, v, u)
            .await?
            .ok_or_else(|| PersistenceError::NotFound("Exercise variant not found".into()))
    }
    async fn delete_exercise_variant_for_user(
        &self,
        e: &str,
        v: &str,
        u: &str,
    ) -> Result<(), PersistenceError> {
        let r=sqlx::query("DELETE FROM exercise_variants WHERE exercise_id=$1::uuid AND id=$2::uuid AND user_id=$3::uuid AND status='new'").bind(e).bind(v).bind(u).execute(&self.pool).await.map_err(map_write)?;
        if r.rows_affected() == 1 {
            return Ok(());
        };
        if exercise_variant(self, e, v, u).await?.is_some() {
            Err(PersistenceError::Conflict(
                "Only draft variants can be deleted".into(),
            ))
        } else {
            Err(PersistenceError::NotFound(
                "Exercise variant not found".into(),
            ))
        }
    }
}
fn map_write(error: sqlx::Error) -> PersistenceError {
    if let sqlx::Error::Database(db) = &error {
        if db.code().as_deref() == Some("23505") {
            return PersistenceError::Conflict("Exercise or variant name already exists".into());
        }
        if db.code().as_deref() == Some("23503") {
            return PersistenceError::Conflict("Exercise or variant is still referenced".into());
        }
    }
    PersistenceError::Sqlx(error)
}
