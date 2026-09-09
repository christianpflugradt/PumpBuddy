use crate::{
    domain::{GymDetail, GymStationDetail, GymSummary, GymUpdate, NewGym},
    persistence::{GymRepository, PersistenceError},
};

#[derive(Debug)]
pub enum GymServiceError {
    Conflict(String),
    NotFound(String),
    Persistence(PersistenceError),
    Validation(String),
}

pub(crate) async fn list_gyms(
    repository: &(impl GymRepository + ?Sized),
    user_id: &str,
    favorite_gym_id: Option<&str>,
) -> Result<Vec<GymSummary>, GymServiceError> {
    repository
        .fetch_gym_summaries_for_user_with_favorite(user_id, favorite_gym_id)
        .await
        .map_err(GymServiceError::Persistence)
}

pub(crate) async fn get_gym_detail(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    user_id: &str,
) -> Result<GymDetail, GymServiceError> {
    repository
        .fetch_gym_detail_for_user(gym_id, user_id)
        .await
        .map_err(GymServiceError::Persistence)?
        .ok_or_else(|| GymServiceError::NotFound("Gym not found".to_owned()))
}

#[allow(dead_code)]
pub(crate) async fn create_gym(
    repository: &(impl GymRepository + ?Sized),
    user_id: &str,
    mut command: NewGym,
) -> Result<GymSummary, GymServiceError> {
    normalize_name(&mut command.name)?;

    if repository
        .gym_name_exists_for_user(user_id, &command.name, None)
        .await
        .map_err(GymServiceError::Persistence)?
    {
        return Err(GymServiceError::Conflict(
            "Gym name already exists".to_owned(),
        ));
    }

    repository
        .create_gym_for_user(user_id, &command)
        .await
        .map_err(map_persistence_error)
}

#[allow(dead_code)]
pub(crate) async fn update_gym(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    user_id: &str,
    mut command: GymUpdate,
) -> Result<GymSummary, GymServiceError> {
    normalize_name(&mut command.name)?;

    if repository
        .gym_name_exists_for_user(user_id, &command.name, Some(gym_id))
        .await
        .map_err(GymServiceError::Persistence)?
    {
        return Err(GymServiceError::Conflict(
            "Gym name already exists".to_owned(),
        ));
    }

    repository
        .update_gym_for_user(gym_id, user_id, &command)
        .await
        .map_err(map_persistence_error)
}

#[allow(dead_code)]
pub(crate) async fn delete_gym(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    user_id: &str,
) -> Result<(), GymServiceError> {
    repository
        .delete_gym_for_user(gym_id, user_id)
        .await
        .map_err(map_persistence_error)
}

pub(crate) async fn get_gym_station_detail(
    repository: &(impl GymRepository + ?Sized),
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<GymStationDetail, GymServiceError> {
    repository
        .fetch_gym_station_detail_for_user(gym_id, station_id, user_id)
        .await
        .map_err(GymServiceError::Persistence)?
        .ok_or_else(|| GymServiceError::NotFound("Gym station not found".to_owned()))
}

#[allow(dead_code)]
fn map_persistence_error(error: PersistenceError) -> GymServiceError {
    match error {
        PersistenceError::Conflict(message) => GymServiceError::Conflict(message),
        PersistenceError::NotFound(message) => GymServiceError::NotFound(message),
        other => GymServiceError::Persistence(other),
    }
}

#[allow(dead_code)]
fn normalize_name(name: &mut String) -> Result<(), GymServiceError> {
    *name = name.trim().to_owned();
    if name.is_empty() {
        return Err(GymServiceError::Validation("name is required".to_owned()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{create_gym, get_gym_detail, GymServiceError};
    use crate::{
        domain::{GymDetail, GymStationDetail, GymSummary, GymUpdate, NewGym},
        persistence::{GymRepository, PersistenceError},
    };

    struct FakeGymRepository {
        detail: Option<GymDetail>,
    }

    impl GymRepository for FakeGymRepository {
        async fn fetch_gym_summaries_for_user_with_favorite(
            &self,
            _user_id: &str,
            _favorite_gym_id: Option<&str>,
        ) -> Result<Vec<GymSummary>, PersistenceError> {
            Ok(Vec::new())
        }

        async fn fetch_gym_detail_for_user(
            &self,
            _gym_id: &str,
            _user_id: &str,
        ) -> Result<Option<GymDetail>, PersistenceError> {
            Ok(self.detail.clone())
        }

        async fn gym_name_exists_for_user(
            &self,
            _user_id: &str,
            name: &str,
            _excluding_id: Option<&str>,
        ) -> Result<bool, PersistenceError> {
            Ok(name.eq_ignore_ascii_case("duplicate"))
        }

        async fn create_gym_for_user(
            &self,
            _user_id: &str,
            new_gym: &NewGym,
        ) -> Result<GymSummary, PersistenceError> {
            Ok(GymSummary {
                id: "new-gym".to_owned(),
                name: new_gym.name.clone(),
                status: "new".to_owned(),
                station_count: 0,
                last_visited_at: None,
            })
        }

        async fn update_gym_for_user(
            &self,
            _gym_id: &str,
            _user_id: &str,
            _update: &GymUpdate,
        ) -> Result<GymSummary, PersistenceError> {
            unreachable!("update is not used by these tests")
        }

        async fn delete_gym_for_user(
            &self,
            _gym_id: &str,
            _user_id: &str,
        ) -> Result<(), PersistenceError> {
            unreachable!("delete is not used by these tests")
        }

        async fn fetch_gym_station_detail_for_user(
            &self,
            _gym_id: &str,
            _station_id: &str,
            _user_id: &str,
        ) -> Result<Option<GymStationDetail>, PersistenceError> {
            Ok(None)
        }
    }

    #[tokio::test]
    async fn get_gym_detail_maps_absent_repository_detail_to_not_found() {
        let repository = FakeGymRepository { detail: None };

        match get_gym_detail(&repository, "missing-gym", "user-id")
            .await
            .expect_err("missing gym should be treated as not found")
        {
            GymServiceError::NotFound(message) => {
                assert_eq!(message, "Gym not found");
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn create_gym_trims_a_valid_name_and_returns_draft_status() {
        let repository = FakeGymRepository { detail: None };

        let gym = create_gym(
            &repository,
            "user-id",
            NewGym {
                name: "  Local Gym  ".to_owned(),
            },
        )
        .await
        .expect("valid gym should be created");

        assert_eq!(gym.name, "Local Gym");
        assert_eq!(gym.status, "new");
    }

    #[tokio::test]
    async fn create_gym_rejects_blank_and_normalized_duplicate_names() {
        let repository = FakeGymRepository { detail: None };

        assert!(matches!(
            create_gym(&repository, "user-id", NewGym { name: "  ".to_owned() }).await,
            Err(GymServiceError::Validation(message)) if message == "name is required"
        ));
        assert!(matches!(
            create_gym(&repository, "user-id", NewGym { name: " Duplicate ".to_owned() }).await,
            Err(GymServiceError::Conflict(message)) if message == "Gym name already exists"
        ));
    }
}
