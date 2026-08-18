use crate::{
    domain::LoadProfileSummary,
    persistence::{LoadProfileRepository, PersistenceError},
};

#[derive(Debug)]
pub enum LoadProfileServiceError {
    Persistence(PersistenceError),
}

pub(crate) async fn list_load_profiles(
    repository: &(impl LoadProfileRepository + ?Sized),
    user_id: &str,
) -> Result<Vec<LoadProfileSummary>, LoadProfileServiceError> {
    repository
        .fetch_load_profile_summaries_for_user(user_id)
        .await
        .map_err(LoadProfileServiceError::Persistence)
}
