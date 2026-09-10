use crate::{
    domain::{
        ExerciseSummary, ExerciseUpdate, ExerciseVariant, ExerciseVariantUpdate, NewExercise,
        NewExerciseVariant,
    },
    persistence::{ExerciseRepository, PersistenceError},
};
#[derive(Debug)]
pub enum ExerciseServiceError {
    Conflict(String),
    NotFound(String),
    Persistence(PersistenceError),
    Validation(String),
}
fn map(error: PersistenceError) -> ExerciseServiceError {
    match error {
        PersistenceError::Conflict(m) => ExerciseServiceError::Conflict(m),
        PersistenceError::NotFound(m) => ExerciseServiceError::NotFound(m),
        other => ExerciseServiceError::Persistence(other),
    }
}
fn name(name: &mut String) -> Result<(), ExerciseServiceError> {
    *name = name.trim().into();
    if name.is_empty() {
        Err(ExerciseServiceError::Validation("name is required".into()))
    } else {
        Ok(())
    }
}
pub(crate) async fn list_exercises(
    r: &(impl ExerciseRepository + ?Sized),
    u: &str,
) -> Result<Vec<ExerciseSummary>, ExerciseServiceError> {
    r.fetch_exercise_summaries_for_user(u)
        .await
        .map_err(ExerciseServiceError::Persistence)
}
pub(crate) async fn get_exercise(
    r: &(impl ExerciseRepository + ?Sized),
    id: &str,
    u: &str,
) -> Result<ExerciseSummary, ExerciseServiceError> {
    r.fetch_exercise_for_user(id, u)
        .await
        .map_err(ExerciseServiceError::Persistence)?
        .ok_or_else(|| ExerciseServiceError::NotFound("Exercise not found".into()))
}
pub(crate) async fn create_exercise(
    r: &(impl ExerciseRepository + ?Sized),
    u: &str,
    mut x: NewExercise,
) -> Result<ExerciseSummary, ExerciseServiceError> {
    name(&mut x.name)?;
    r.create_exercise_for_user(u, &x).await.map_err(map)
}
pub(crate) async fn update_exercise(
    r: &(impl ExerciseRepository + ?Sized),
    id: &str,
    u: &str,
    mut x: ExerciseUpdate,
) -> Result<ExerciseSummary, ExerciseServiceError> {
    name(&mut x.name)?;
    r.update_exercise_for_user(id, u, &x).await.map_err(map)
}
pub(crate) async fn delete_exercise(
    r: &(impl ExerciseRepository + ?Sized),
    id: &str,
    u: &str,
) -> Result<(), ExerciseServiceError> {
    r.delete_exercise_for_user(id, u).await.map_err(map)
}
pub(crate) async fn list_variants(
    r: &(impl ExerciseRepository + ?Sized),
    id: &str,
    u: &str,
) -> Result<Vec<ExerciseVariant>, ExerciseServiceError> {
    r.fetch_exercise_variants_for_user(id, u)
        .await
        .map_err(ExerciseServiceError::Persistence)?
        .ok_or_else(|| ExerciseServiceError::NotFound("Exercise not found".into()))
}
pub(crate) async fn get_variant(
    r: &(impl ExerciseRepository + ?Sized),
    e: &str,
    id: &str,
    u: &str,
) -> Result<ExerciseVariant, ExerciseServiceError> {
    r.fetch_exercise_variant_for_user(e, id, u)
        .await
        .map_err(ExerciseServiceError::Persistence)?
        .ok_or_else(|| ExerciseServiceError::NotFound("Exercise variant not found".into()))
}
pub(crate) async fn create_variant(
    r: &(impl ExerciseRepository + ?Sized),
    e: &str,
    u: &str,
    mut x: NewExerciseVariant,
) -> Result<ExerciseVariant, ExerciseServiceError> {
    name(&mut x.name)?;
    r.create_exercise_variant_for_user(e, u, &x)
        .await
        .map_err(map)
}
pub(crate) async fn update_variant(
    r: &(impl ExerciseRepository + ?Sized),
    e: &str,
    id: &str,
    u: &str,
    mut x: ExerciseVariantUpdate,
) -> Result<ExerciseVariant, ExerciseServiceError> {
    name(&mut x.name)?;
    r.update_exercise_variant_for_user(e, id, u, &x)
        .await
        .map_err(map)
}
pub(crate) async fn delete_variant(
    r: &(impl ExerciseRepository + ?Sized),
    e: &str,
    id: &str,
    u: &str,
) -> Result<(), ExerciseServiceError> {
    r.delete_exercise_variant_for_user(e, id, u)
        .await
        .map_err(map)
}
