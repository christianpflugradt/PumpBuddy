use crate::{
    domain::{
        LoadProfileDefinitionInput, LoadProfileDetail, LoadProfileSummary, LoadProfileUpdate,
        NewLoadProfile,
    },
    persistence::{LoadProfileRepository, PersistenceError},
};

#[derive(Debug)]
pub enum LoadProfileServiceError {
    Conflict(String),
    NotFound(String),
    Persistence(PersistenceError),
    Validation(String),
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

pub(crate) async fn get_load_profile(
    repository: &(impl LoadProfileRepository + ?Sized),
    load_profile_id: &str,
    user_id: &str,
) -> Result<LoadProfileDetail, LoadProfileServiceError> {
    repository
        .fetch_load_profile_detail_for_user(load_profile_id, user_id)
        .await
        .map_err(LoadProfileServiceError::Persistence)?
        .ok_or_else(|| LoadProfileServiceError::NotFound("Load profile not found".to_owned()))
}

pub(crate) async fn create_load_profile(
    repository: &(impl LoadProfileRepository + ?Sized),
    user_id: &str,
    mut command: NewLoadProfile,
) -> Result<LoadProfileSummary, LoadProfileServiceError> {
    normalize_name(&mut command.name)?;
    validate_definition(&command.definition)?;

    if repository
        .load_profile_name_exists_for_user(user_id, &command.name, None)
        .await
        .map_err(LoadProfileServiceError::Persistence)?
    {
        return Err(LoadProfileServiceError::Conflict(
            "Load profile name already exists".to_owned(),
        ));
    }

    repository
        .create_load_profile_for_user(user_id, &command)
        .await
        .map_err(map_persistence_error)
}

pub(crate) async fn update_load_profile(
    repository: &(impl LoadProfileRepository + ?Sized),
    load_profile_id: &str,
    user_id: &str,
    mut command: LoadProfileUpdate,
) -> Result<LoadProfileSummary, LoadProfileServiceError> {
    normalize_name(&mut command.name)?;

    if command.weight_unit.is_some() ^ command.definition.is_some() {
        return Err(LoadProfileServiceError::Validation(
            "weight_unit and definition must be updated together".to_owned(),
        ));
    }

    if let Some(definition) = &command.definition {
        validate_definition(definition)?;
    }

    if repository
        .load_profile_name_exists_for_user(user_id, &command.name, Some(load_profile_id))
        .await
        .map_err(LoadProfileServiceError::Persistence)?
    {
        return Err(LoadProfileServiceError::Conflict(
            "Load profile name already exists".to_owned(),
        ));
    }

    repository
        .update_load_profile_for_user(load_profile_id, user_id, &command)
        .await
        .map_err(map_persistence_error)
}

pub(crate) async fn delete_load_profile(
    repository: &(impl LoadProfileRepository + ?Sized),
    load_profile_id: &str,
    user_id: &str,
) -> Result<(), LoadProfileServiceError> {
    repository
        .delete_load_profile_for_user(load_profile_id, user_id)
        .await
        .map_err(map_persistence_error)
}

fn map_persistence_error(error: PersistenceError) -> LoadProfileServiceError {
    match error {
        PersistenceError::Conflict(message) => LoadProfileServiceError::Conflict(message),
        PersistenceError::NotFound(message) => LoadProfileServiceError::NotFound(message),
        other => LoadProfileServiceError::Persistence(other),
    }
}

fn normalize_name(name: &mut String) -> Result<(), LoadProfileServiceError> {
    *name = name.trim().to_owned();
    if name.is_empty() {
        return Err(LoadProfileServiceError::Validation(
            "name is required".to_owned(),
        ));
    }
    Ok(())
}

fn validate_definition(
    definition: &LoadProfileDefinitionInput,
) -> Result<(), LoadProfileServiceError> {
    match definition.kind.as_str() {
        "fixed_list" => {
            let values = definition.values.as_ref().ok_or_else(|| {
                LoadProfileServiceError::Validation(
                    "fixed_list definition must include values".to_owned(),
                )
            })?;

            if values.is_empty() {
                return Err(LoadProfileServiceError::Validation(
                    "fixed_list definition values must not be empty".to_owned(),
                ));
            }

            if definition.min.is_some() || definition.step.is_some() {
                return Err(LoadProfileServiceError::Validation(
                    "fixed_list definition must not include min or step".to_owned(),
                ));
            }
        }
        "formula" => {
            let min = definition.min.ok_or_else(|| {
                LoadProfileServiceError::Validation(
                    "formula definition must include min".to_owned(),
                )
            })?;
            let step = definition.step.ok_or_else(|| {
                LoadProfileServiceError::Validation(
                    "formula definition must include step".to_owned(),
                )
            })?;

            if definition.values.is_some() {
                return Err(LoadProfileServiceError::Validation(
                    "formula definition must not include values".to_owned(),
                ));
            }

            if min < 0.0 {
                return Err(LoadProfileServiceError::Validation(
                    "formula definition min must be non-negative".to_owned(),
                ));
            }

            if step <= 0.0 {
                return Err(LoadProfileServiceError::Validation(
                    "formula definition step must be greater than 0".to_owned(),
                ));
            }
        }
        _ => {
            return Err(LoadProfileServiceError::Validation(
                "definition kind must be fixed_list or formula".to_owned(),
            ));
        }
    }

    Ok(())
}
